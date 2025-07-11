import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp, getDocs, setDoc } from 'firebase/firestore';

// Context for Firebase and Auth
const FirebaseContext = createContext(null);

// Tab Button Component for Sidebar
function TabButton({ label, tabId, activeTab, setActiveTab }) {
  return (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`py-3 px-4 text-left text-lg font-semibold rounded-lg transition-colors duration-200
        ${activeTab === tabId ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'text-white hover:bg-[#003300]'} /* Lime green for active, darker green for hover */
      `}
    >
      {label}
    </button>
  );
}

// Main App Component
function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loadingFirebase, setLoadingFirebase] = useState(true);
  const [error, setError] = useState(null);

  // State for active tab in the main App component, passed down to SponsorshipCRM
  const [activeTab, setActiveTab] = useState('inicio');


  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
          throw new Error("Firebase configuration is missing or empty.");
        }

        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestoreDb);
        setAuth(firebaseAuth);

        // Sign in anonymously or with custom token
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(firebaseAuth, __initial_auth_token);
        } else {
          await signInAnonymously(firebaseAuth);
        }

        // Listen for auth state changes
        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(null);
          }
          setLoadingFirebase(false);
        });

        return () => unsubscribe(); // Cleanup on unmount
      } catch (e) {
        console.error("Erro ao inicializar Firebase:", e);
        setError("Erro ao carregar a aplicação. Por favor, tente novamente.");
        setLoadingFirebase(false);
      }
    };

    initializeFirebase();
  }, []); // Run only once on component mount

  if (loadingFirebase) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">A carregar aplicação...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={{ db, auth, userId }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-blue-50 to-indigo-100 font-inter">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-[#002200] text-white flex flex-col p-4 shadow-lg md:min-h-screen"> {/* Even darker green background */}
          <h1 className="text-3xl font-extrabold text-center text-white mb-6 drop-shadow-sm">
            CRM SAD
          </h1>
          {userId && (
            <p className="text-center text-sm text-gray-200 mb-6">
              ID do Utilizador: <span className="font-mono bg-gray-700 px-2 py-1 rounded-md text-xs">{userId}</span> {/* Dark grey for user ID background */}
            </p>
          )}
          <nav className="flex flex-col space-y-2">
            <TabButton label="Início" tabId="inicio" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Leads" tabId="dashboard" activeTab={activeTab} setActiveTab={setActiveTab} /> {/* Renamed Dashboard to Leads */}
            <TabButton label="Contactos" tabId="contactList" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Clientes" tabId="clientes" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Agenda" tabId="overview" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Sponsorship" tabId="benefits" activeTab={activeTab} setActiveTab={setActiveTab} /> {/* Renamed Benefits to Sponsorship */}
            <TabButton label="Modelos de Contrato" tabId="contractTemplates" activeTab={activeTab} setActiveTab={setActiveTab} />
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-grow p-4 bg-white rounded-l-xl md:rounded-l-none md:rounded-tl-xl shadow-2xl md:shadow-none">
          {/* Pass activeTab and setActiveTab to SponsorshipCRM */}
          <SponsorshipCRM activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </div>
    </FirebaseContext.Provider>
  );
}


// Sponsorship CRM Component (receives activeTab and setActiveTab as props)
function SponsorshipCRM({ activeTab, setActiveTab }) { // Receive props
  const { db, userId } = useContext(FirebaseContext);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [filterPhase, setFilterPhase] = useState('Todos');
  const [filterLeadManager, setFilterLeadManager] = useState('Todos'); // New state for lead manager filter
  const [filterIndustry, setFilterIndustry] = useState('Todos'); // New state for industry filter
  // activeTab state is now managed by parent App component
  const [contractTemplate, setContractTemplate] = useState('');
  const [showContractModal, setShowContractModal] = useState(false);
  const [generatedContract, setGeneratedContract] = useState('');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [contactForActivity, setContactForActivity] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false); // New state for email modal
  const [contactForEmail, setContactForEmail] = useState(null); // New state for contact in email modal
  const [sponsorshipTiers, setSponsorshipTiers] = useState([]); // New state for sponsorship tiers


  // Negotiation phases
  const negotiationPhases = [
    "Contacto Inicial",
    "Proposta Enviada",
    "Negociação",
    "Fechado",
    "Perdido"
  ];

  // Lead Managers
  const leadManagers = [
    "Gonçalo Romão",
    "Tiago Westenfeld"
  ];

  // Industry List
  const industryList = [
    "Tecnologia",
    "Finanças",
    "Saúde",
    "Educação",
    "Retalho",
    "Manufatura",
    "Serviços",
    "Imobiliário",
    "Automóvel",
    "Energia",
    "Média e Entretenimento",
    "Turismo e Hotelaria",
    "Agricultura",
    "Construção",
    "Telecomunicações",
    "Consultoria",
    "Marketing e Publicidade",
    "Transportes e Logística",
    "Alimentos e Bebidas",
    "Moda"
  ];

  // Default contract template for demonstration
  const defaultContractTemplate = `
<style>
    body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        text-align: justify;
        margin: 0; /* Important for PDF rendering */
        padding: 0; /* Important for PDF rendering */
        color: #000000;
        font-size: 11pt; /* Standard font size for documents */
    }
    h1 {
        text-align: center;
        font-size: 16pt;
        margin-bottom: 20px;
    }
    p {
        margin-bottom: 10px;
        orphans: 3; /* Minimum lines of a paragraph left at the bottom of a page */
        widows: 3;  /* Minimum lines of a paragraph carried over to the top of a new page */
    }
    ul {
        margin-bottom: 10px;
        padding-left: 20px;
    }
    li {
        margin-bottom: 5px;
    }
    strong {
        font-weight: bold;
    }
    /* Class to force page break before signature block if needed */
    .page-break-before {
        page-break-before: always;
    }
    .signature-block {
        page-break-inside: avoid; /* Keep signature block together */
    }
</style>
<h1 style="text-align: center;">CONTRATO DE PATROCÍNIO</h1>

<p>Este Contrato de Patrocínio ("Contrato") é celebrado em {{DATA_ATUAL}} entre:</p>

<p>1.  <strong>Sport Algés e Dafundo</strong> (doravante "Patrocinado"), com sede in Avenida Combatentes da Grande Guerra, 88, 1495-035 Algés, Portugal, e NIF 500276668.</p>

<p>E</p>

<p>2.  <strong>{{EMPRESA}}</strong> (doravante "Patrocinador"), com nome social {{NOME_SOCIAL}}, NIF {{NIF}}, e sede em {{MORADA_FISCAL}}.</p>
    <p>Representado por: {{NOME_CONTACTO}} (Email: {{EMAIL}}, Telefone: {{TELEFONE}}).</p>

<p><strong>Considerando que:</strong></p>
<ul>
    <li>O Patrocinado está a organizar [Nome do Evento/Projeto] que ocorrerá em [Data do Evento/Projeto].</li>
    <li>O Patrocinador deseja apoiar e associar a sua marca ao [Nome do Evento/Projeto].</li>
</ul>

<p><strong>Acordam o seguinte:</strong></p>

<p><strong>1. Objeto do Patrocínio</strong><br>
O Patrocinador compromete-se a conceder um patrocínio no valor total de {{VALOR_NEGOCIACAO}} EUR ({{VALOR_NEGOCIACAO_POR_EXTENSO}} Euros).</p>

<p><strong>2. Contrapartidas do Patrocinado</strong><br>
Em contrapartida, o Patrocinado oferece ao Patrocinador:</p>
<ul>
    <li>[Listar contrapartidas específicas, ex: Logótipo em materiais de divulgação, menção em redes sociais, espaço de stand, etc.]</li>
</ul>

<p><strong>3. Prazo</strong><br>
Este Contrato tem início em {{DATA_ATUAL}} e termina em [Data de Término do Contrato].</p>

<p><strong>4. Gerente da Lead</strong><br>
A gestão desta lead está a cargo de: {{GERENTE_LEAD}}.</p>

<p><strong>5. Notas da Negociação</strong><br>
Notas relevantes: {{NOTAS}}<br>
Fase atual da negociação: {{FASE_NEGOCIACAO}}<br>
Próxima Reunião Agendada: {{DATA_REUNIAO}}</p>

<p><strong>6. Disposições Gerais</strong><br>
[Cláusulas gerais como confidencialidade, rescisão, foro, etc.]</p>

<div class="page-break-before signature-block" style="margin-top: 80px;">
    <p>E, por estarem assim justos e contratados, as partes assinam o presente Contrato em duas vias de igual teor e forma.</p>

    <p style="margin-top: 50px;">___________________________               ___________________________<br>
    [Seu Nome/Representante]                    [Nome do Contacto]<br>
    Patrocinado                                 Patrocinador</p>
</div>
`;


  useEffect(() => {
    if (!db || !userId) return;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const contactsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/sponsorshipContacts`);
    const qContacts = query(contactsCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribeContacts = onSnapshot(qContacts, (snapshot) => {
      const fetchedContacts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setContacts(fetchedContacts);
    }, (error) => {
      console.error("Erro ao obter contactos:", error);
      // Optionally display an error message to the user
    });

    // New: Fetch activities
    const activitiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/activities`);
    const qActivities = query(activitiesCollectionRef, orderBy('activityDateTime', 'desc'));

    const unsubscribeActivities = onSnapshot(qActivities, (snapshot) => {
      const fetchedActivities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setActivities(fetchedActivities);
    }, (error) => {
      console.error("Erro ao obter atividades:", error);
    });

    // New: Fetch sponsorship tiers
    const sponsorshipTiersDocRef = doc(db, `artifacts/${appId}/users/${userId}/sponsorshipTiers`, 'packages');
    const unsubscribeTiers = onSnapshot(sponsorshipTiersDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setSponsorshipTiers(docSnap.data().tiers || []);
      } else {
        // Set default tiers if none exist
        setSponsorshipTiers([
          { name: "Ouro 🥇", benefits: "Logotipo em destaque, 10 posts em redes sociais, stand 5x5m", value: 100000, duration: "1 ano", limit: 1 },
          { name: "Prata 🥈", benefits: "Logotipo visível, 5 posts em redes sociais, stand 3x3m", value: 50000, duration: "1 ano", limit: 2 },
          { name: "Bronze 🥉", benefits: "Menção em redes sociais, logotipo em lista", value: 10000, duration: "1 ano", limit: 5 },
        ]);
        // Also save defaults to Firestore if they don't exist
        setDoc(sponsorshipTiersDocRef, { tiers: [
          { name: "Ouro 🥇", benefits: "Logotipo em destaque, 10 posts em redes sociais, stand 5x5m", value: 100000, duration: "1 ano", limit: 1 },
          { name: "Prata 🥈", benefits: "Logotipo visível, 5 posts em redes sociais, stand 3x3m", value: 50000, duration: "1 ano", limit: 2 },
          { name: "Bronze 🥉", benefits: "Menção em redes sociais, logotipo em lista", value: 10000, duration: "1 ano", limit: 5 },
        ]}, { merge: true });
      }
    }, (error) => {
      console.error("Erro ao obter níveis de patrocínio:", error);
    });


    // Fetch contract template
    const templateDocRef = doc(db, `artifacts/${appId}/users/${userId}/contractTemplates`, 'mainTemplate');
    const unsubscribeTemplate = onSnapshot(templateDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setContractTemplate(docSnap.data().templateText);
      } else {
        // If no template exists, set a default one
        setContractTemplate(defaultContractTemplate);
      }
    }, (error) => {
      console.error("Erro ao obter modelo de contrato:", error);
    });


    return () => {
      unsubscribeContacts();
      unsubscribeActivities(); // Cleanup activities listener
      unsubscribeTiers(); // Cleanup tiers listener
      unsubscribeTemplate();
    }; // Cleanup on unmount
  }, [db, userId]);

  const handleAddContact = async (contact) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/sponsorshipContacts`), {
        ...contact,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowAddForm(false);
    } catch (e) {
      console.error("Erro ao adicionar contacto:", e);
      // Optionally display an error message
    }
  };

  const handleUpdateContact = async (id, updatedFields) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const contactRef = doc(db, `artifacts/${appId}/users/${userId}/sponsorshipContacts`, id);
      await updateDoc(contactRef, {
        ...updatedFields,
        updatedAt: serverTimestamp()
      });
      setEditingContact(null); // Exit editing mode
    } catch (e) {
      console.error("Erro ao atualizar contacto:", e);
      // Optionally display an error message
    }
  };

  const handleDeleteContact = async (id) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const contactRef = doc(db, `artifacts/${appId}/users/${userId}/sponsorshipContacts`, id);
      await deleteDoc(contactRef);
      setShowDeleteModal(false);
      setContactToDelete(null);
    } catch (e) {
      console.error("Erro ao eliminar contacto:", e);
      // Optionally display an error message
    }
  };

  const handleAddActivity = async (activity) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/activities`), {
        ...activity,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowActivityModal(false);
      setContactForActivity(null);
    } catch (e) {
      console.error("Erro ao adicionar atividade:", e);
    }
  };

  const handleUpdateSponsorshipTiers = async (updatedTiers) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const sponsorshipTiersDocRef = doc(db, `artifacts/${appId}/users/${userId}/sponsorshipTiers`, 'packages');
      await setDoc(sponsorshipTiersDocRef, { tiers: updatedTiers }, { merge: true });
      alert('Níveis de patrocínio guardados com sucesso!');
    } catch (e) {
      console.error("Erro ao guardar níveis de patrocínio:", e);
      alert('Erro ao guardar níveis de patrocínio.');
    }
  };


  const confirmDelete = (contact) => {
    setContactToDelete(contact);
    setShowDeleteModal(true);
  };

  const handleSaveTemplate = async (templateText) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const templateDocRef = doc(db, `artifacts/${appId}/users/${userId}/contractTemplates`, 'mainTemplate');
      // Use setDoc with merge: true to create the document if it doesn't exist, or update it if it does.
      await setDoc(templateDocRef, { templateText }, { merge: true });
      alert('Modelo de contrato guardado com sucesso!'); // Using alert for simplicity here
    } catch (e) {
      console.error("Erro ao guardar modelo de contrato:", e);
      alert('Erro ao guardar modelo de contrato.'); // Using alert for simplicity here
    }
  };

  const generateContractForContact = (contact) => {
    if (!contractTemplate) {
      alert('Nenhum modelo de contrato definido. Por favor, vá à aba "Modelos de Contrato" para definir um.');
      return;
    }

    let filledContract = contractTemplate;

    // Helper to format currency
    const formatCurrency = (value) => {
      if (value === undefined || value === null || value === '') return '0,00';
      return parseFloat(value).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Helper to convert number to words (simple example, can be expanded)
    const numberToWords = (num) => {
      const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
      const teens = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
      const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
      const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

      if (num === 0) return 'zero';

      let s = num.toString();
      let result = '';

      const convertLessThanThousand = (n) => {
        if (n < 10) return units[n];
        if (n >= 10 && n < 20) return teens[n - 10];
        if (n >= 20 && n < 100) {
          const ten = tens[Math.floor(n / 10)];
          const unit = units[n % 10];
          return ten + (unit ? ' e ' + unit : '');
        }
        if (n >= 100 && n < 1000) {
          const hundred = hundreds[Math.floor(n / 100)];
          const remainder = n % 100;
          if (remainder === 0) return hundred;
          if (n === 100) return 'cem';
          return hundred + ' e ' + convertLessThanThousand(remainder);
        }
        return '';
      };

      const parts = [];
      let i = 0;
      while (s.length > 0) {
        let chunk = parseInt(s.slice(-3));
        s = s.slice(0, -3);
        if (chunk > 0) {
          let chunkText = convertLessThanThousand(chunk);
          if (i === 1) chunkText += ' mil';
          if (i === 2) chunkText += ' milhões'; // Simplistic, needs more for billions etc.
          parts.unshift(chunkText);
        }
        i++;
      }
      return parts.join(' ').trim();
    };

    // Replace placeholders
    filledContract = filledContract.replace(/{{NOME_SOCIAL}}/g, contact.socialName || '[Nome Social Não Definido]');
    filledContract = filledContract.replace(/{{NIF}}/g, contact.nif || '[NIF Não Definido]');
    filledContract = filledContract.replace(/{{VALOR_NEGOCIACAO}}/g, formatCurrency(contact.negotiationValue));
    filledContract = filledContract.replace(/{{VALOR_NEGOCIACAO_POR_EXTENSO}}/g, numberToWords(parseFloat(contact.negotiationValue || 0)));
    filledContract = filledContract.replace(/{{NOME_CONTACTO}}/g, contact.name || '[Nome do Contacto Não Definido]');
    filledContract = filledContract.replace(/{{EMPRESA}}/g, contact.company || '[Empresa Não Definida]');
    filledContract = filledContract.replace(/{{EMAIL}}/g, contact.email || '[Email Não Definido]');
    filledContract = filledContract.replace(/{{TELEFONE}}/g, contact.phone || '[Telefone Não Definido]');
    filledContract = filledContract.replace(/{{MORADA_FISCAL}}/g, contact.taxAddress || '[Morada Fiscal Não Definida]'); // New placeholder
    filledContract = filledContract.replace(/{{GERENTE_LEAD}}/g, contact.leadManager || '[Gerente da Lead Não Definido]');
    filledContract = filledContract.replace(/{{NOTAS}}/g, contact.notes || '[Sem Notas]');
    filledContract = filledContract.replace(/{{FASE_NEGOCIACAO}}/g, contact.negotiationPhase || '[Fase Não Definida]');
    filledContract = filledContract.replace(/{{DATA_REUNIAO}}/g, contact.meetingDateTime ? new Date(contact.meetingDateTime).toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' }) : '[Reunião Não Agendada]');
    filledContract = filledContract.replace(/{{DATA_ATUAL}}/g, new Date().toLocaleDateString('pt-PT', { dateStyle: 'long' }));


    setGeneratedContract(filledContract);
    setShowContractModal(true);
  };


  const filteredContacts = filterPhase === 'Todos'
    ? contacts
    : contacts.filter(contact => contact.negotiationPhase === filterPhase);

  return (
    <div className="flex-grow p-4 bg-white rounded-l-xl md:rounded-l-none md:rounded-tl-xl shadow-2xl md:shadow-none">
      {activeTab === 'inicio' && (
        <MainPage contacts={contacts} activities={activities} leadManagers={leadManagers} />
      )}

      {activeTab === 'dashboard' && ( // This is now 'Projetos'
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-700">Os Seus Projetos</h2> {/* Renamed title */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75" /* Lime green button */
            >
              {showAddForm ? 'Cancelar' : 'Adicionar Novo Contacto'}
            </button>
          </div>

          {showAddForm && (
            <ContactForm
              onSubmit={handleAddContact}
              onCancel={() => setShowAddForm(false)}
              negotiationPhases={negotiationPhases}
              leadManagers={leadManagers}
              industryList={industryList}
              sponsorshipTiers={sponsorshipTiers} /* Pass sponsorshipTiers */
            />
          )}

          <div className="mb-6">
            <label htmlFor="filterPhase" className="block text-gray-700 text-sm font-bold mb-2">
              Filtrar por Fase:
            </label>
            <select
              id="filterPhase"
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            >
              <option value="Todos">Todos</option>
              {negotiationPhases.map(phase => (
                <option key={phase} value={phase}>{phase}</option>
              ))}
            </select>
          </div>

          {filteredContacts.length === 0 ? (
            <p className="text-center text-gray-500 text-lg py-10">
              Nenhum contacto encontrado. Adicione um novo para começar!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContacts.map(contact => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onUpdate={handleUpdateContact}
                  onDelete={confirmDelete}
                  onEdit={() => setEditingContact(contact)}
                  isEditing={editingContact && editingContact.id === contact.id}
                  negotiationPhases={negotiationPhases}
                  leadManagers={leadManagers}
                  setEditingContact={setEditingContact}
                  onGenerateContract={generateContractForContact}
                  onScheduleActivity={() => { setContactForActivity(contact); setShowActivityModal(true); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'contactList' && (
        <ContactListView contacts={contacts} leadManagers={leadManagers} filterLeadManager={filterLeadManager} setFilterLeadManager={setFilterLeadManager} industryList={industryList} filterIndustry={filterIndustry} setFilterIndustry={setFilterIndustry} />
      )}

      {activeTab === 'clientes' && (
        <Database
          contacts={contacts}
          activities={activities}
          onUpdateContact={handleUpdateContact}
          onAddActivity={handleAddActivity}
          setEditingContact={setEditingContact}
          editingContact={editingContact}
          showActivityModal={showActivityModal}
          setShowActivityModal={setShowActivityModal}
          contactForActivity={contactForActivity}
          setContactForActivity={setContactForActivity}
          negotiationPhases={negotiationPhases}
          leadManagers={leadManagers}
          industryList={industryList}
          sponsorshipTiers={sponsorshipTiers} /* Pass sponsorshipTiers */
        />
      )}

      {activeTab === 'overview' && (
        <Overview contacts={contacts} negotiationPhases={negotiationPhases} activities={activities} />
      )}

      {activeTab === 'benefits' && ( /* New BenefitsManagement component */
        <BenefitsManagement
          sponsorshipTiers={sponsorshipTiers}
          onUpdateSponsorshipTiers={handleUpdateSponsorshipTiers}
          contacts={contacts} /* Pass contacts to BenefitsManagement */
          allContacts={contacts} /* Pass all contacts for assignment dropdown */
          onUpdateContact={handleUpdateContact} /* Pass onUpdateContact for assigning tiers */
        />
      )}

      {activeTab === 'contractTemplates' && (
        <ContractTemplates
          templateText={contractTemplate}
          onSaveTemplate={handleSaveTemplate}
        />
      )}

      {showDeleteModal && contactToDelete && (
        <DeleteConfirmationModal
          contactName={contactToDelete.name}
          onConfirm={() => handleDeleteContact(contactToDelete.id)}
          onCancel={() => { setShowDeleteModal(false); setContactToDelete(null); }}
        />
      )}

      {showContractModal && (
        <ContractDisplayModal
          contractText={generatedContract}
          onClose={() => setShowContractModal(false)}
        />
      )}

      {showActivityModal && contactForActivity && (
        <ActivityFormModal
          contact={contactForActivity}
          onSubmit={handleAddActivity}
          onClose={() => { setShowActivityModal(false); setContactForActivity(null); }}
        />
      )}
    </div>
  );
}

// Main Page Component
function MainPage({ contacts, activities, leadManagers }) {
  const today = new Date();
  const todayString = today.toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const todayMeetings = activities.filter(activity => {
    if (!activity.activityDateTime) return false;
    const activityDate = new Date(activity.activityDateTime.toDate());
    return activityDate.getDate() === today.getDate() &&
           activityDate.getMonth() === today.getMonth() &&
           activityDate.getFullYear() === today.getFullYear();
  }).sort((a, b) => new Date(a.activityDateTime.toDate()) - new Date(b.activityDateTime.toDate()));

  // Alerts Logic
  const alerts = [];
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);
  oneWeekAgo.setHours(0, 0, 0, 0);

  contacts.forEach(contact => {
    const contactActivities = activities.filter(act => act.contactId === contact.id);

    const sortedActivities = contactActivities.sort((a, b) => new Date(b.activityDateTime.toDate()) - new Date(a.activityDateTime.toDate()));
    const latestPastActivity = sortedActivities.find(act => new Date(act.activityDateTime.toDate()) <= today);
    const nextFutureActivity = contactActivities.find(act => new Date(act.activityDateTime.toDate()) > today);


    if (!latestPastActivity) {
      alerts.push({
        type: 'warning',
        message: `O contacto "${contact.name}" da empresa "${contact.company}" não tem atividades passadas registadas. Considere agendar algo!`,
        contact: contact
      });
    } else if (new Date(latestPastActivity.activityDateTime.toDate()) < oneWeekAgo && !nextFutureActivity) {
      alerts.push({
        type: 'warning',
        message: `Está há mais de uma semana (${new Date(latestPastActivity.activityDateTime.toDate()).toLocaleDateString('pt-PT')}) sem contactar "${contact.name}" da empresa "${contact.company}". Quer agendar algo?`,
        contact: contact
      });
    }

    if (nextFutureActivity) {
      const activityDate = new Date(nextFutureActivity.activityDateTime.toDate());
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(today.getDate() + 7);
      sevenDaysFromNow.setHours(23, 59, 59, 999);

      if (activityDate > today && activityDate <= sevenDaysFromNow) {
        alerts.push({
          type: 'info',
          message: `Lembrete: "${nextFutureActivity.activityType}" com "${contact.name}" (${contact.company}) agendado para ${activityDate.toLocaleDateString('pt-PT')} às ${activityDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}.`,
          contact: contact
        });
      }
    }

  });

  // KPI Logic
  const [selectedKpiManager, setSelectedKpiManager] = useState('Todos');
  const [seasonGoal, setSeasonGoal] = useState(50000); // Default season goal

  const getKpiData = (manager) => {
    const managerContacts = manager === 'Todos' ? contacts : contacts.filter(c => c.leadManager === manager);
    const managerActivities = manager === 'Todos' ? activities : activities.filter(a => contacts.find(c => c.id === a.contactId)?.leadManager === manager);

    // Leads Captadas por dia (last 7 days)
    const leadsByDay = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      leadsByDay[dateKey] = 0;
    }
    managerContacts.forEach(contact => {
      const createdAtDate = contact.createdAt ? new Date(contact.createdAt.toDate()) : null;
      if (createdAtDate) {
        const dateKey = createdAtDate.toISOString().split('T')[0];
        if (leadsByDay.hasOwnProperty(dateKey)) {
          leadsByDay[dateKey]++;
        }
      }
    });

    // Contactos feitos por dia (last 7 days)
    const contactsByDay = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      contactsByDay[dateKey] = 0;
    }
    managerActivities.forEach(activity => {
      const activityDate = activity.activityDateTime ? new Date(activity.activityDateTime.toDate()) : null;
      if (activityDate) {
        const dateKey = activityDate.toISOString().split('T')[0];
        if (contactsByDay.hasOwnProperty(dateKey)) {
          contactsByDay[dateKey]++;
        }
      }
    });

    // Montante gerado em vendas por mês (last 6 months)
    const amountGeneratedByMonth = {};
    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      amountGeneratedByMonth[monthKey] = 0;
    }

    managerContacts.forEach(contact => {
      if (contact.negotiationPhase === 'Fechado' && contact.updatedAt) {
        const closedDate = new Date(contact.updatedAt.toDate());
        const monthKey = `${closedDate.getFullYear()}-${(closedDate.getMonth() + 1).toString().padStart(2, '0')}`;
        if (amountGeneratedByMonth.hasOwnProperty(monthKey)) {
          amountGeneratedByMonth[monthKey] += parseFloat(contact.negotiationValue || 0);
        }
      }
    });

    // Total amount generated for the current season (assuming current year is the season)
    const currentSeasonAmount = managerContacts.reduce((sum, contact) => {
      if (contact.negotiationPhase === 'Fechado' && contact.updatedAt) {
        const closedDate = new Date(contact.updatedAt.toDate());
        if (closedDate.getFullYear() === today.getFullYear()) { // Simple season definition
          return sum + parseFloat(contact.negotiationValue || 0);
        }
      }
      return sum;
    }, 0);

    const seasonProgress = seasonGoal > 0 ? (currentSeasonAmount / seasonGoal) * 100 : 0;
    const seasonProgressColor = seasonProgress < 50 ? 'bg-red-500' : seasonProgress < 80 ? 'bg-orange-500' : 'bg-green-500';


    return { leadsByDay, contactsByDay, amountGeneratedByMonth, currentSeasonAmount, seasonProgress, seasonProgressColor };
  };

  const kpiData = getKpiData(selectedKpiManager);

  // Helper for generating bar chart SVG
  const renderBarChart = (data, title, valueFormatter, labelFormatter) => {
    const values = Object.values(data);
    const labels = Object.keys(data);
    const maxVal = Math.max(...values);
    const chartHeight = 150;
    const barWidth = 20;
    const barSpacing = 10;
    const chartWidth = labels.length * (barWidth + barSpacing);

    return (
      <div className="bg-gray-50 p-4 rounded-lg shadow-inner border border-gray-100">
        <h4 className="text-lg font-semibold text-gray-700 mb-2">{title}</h4>
        <div className="overflow-x-auto">
          <svg width={chartWidth} height={chartHeight + 30}>
            {/* Bars */}
            {values.map((val, index) => {
              const barHeight = maxVal === 0 ? 0 : (val / maxVal) * chartHeight;
              const x = index * (barWidth + barSpacing);
              const y = chartHeight - barHeight;
              return (
                <rect
                  key={index}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="#006400" // Dark green for bars
                  rx="3" ry="3" // Rounded corners for bars
                />
              );
            })}
            {/* Labels */}
            {labels.map((label, index) => (
              <text
                key={index}
                x={index * (barWidth + barSpacing) + barWidth / 2}
                y={chartHeight + 15}
                textAnchor="middle"
                fontSize="10"
                fill="#374151" // gray-700
              >
                {labelFormatter ? labelFormatter(label) : label}
              </text>
            ))}
            {/* Values on top of bars */}
            {values.map((val, index) => {
              const barHeight = maxVal === 0 ? 0 : (val / maxVal) * chartHeight;
              const x = index * (barWidth + barSpacing) + barWidth / 2;
              const y = chartHeight - barHeight - 5; // 5px above the bar
              return (
                <text
                  key={`val-${index}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#1f2937" // gray-900
                >
                  {valueFormatter ? valueFormatter(val) : val}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };


  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Página Principal</h2>

      <div className="bg-blue-50 p-6 rounded-lg shadow-md border border-blue-200 mb-6 text-center">
        <p className="text-xl font-semibold text-blue-800">Hoje é {todayString}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-xl font-bold text-gray-700 mb-4">Alertas e Notificações</h3>
          {alerts.length === 0 ? (
            <p className="text-gray-500 italic">Nenhum alerta ou notificação pendente.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-2">
              {alerts.map((alert, index) => (
                <li key={index} className={`${alert.type === 'warning' ? 'text-orange-700' : 'text-blue-700'} text-sm`}>
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-xl font-bold text-gray-700 mb-4">Eventos de Hoje</h3>
          {todayMeetings.length === 0 ? (
            <p className="text-gray-500 italic">Nenhuma reunião agendada para hoje.</p>
          ) : (
            <ul className="list-disc pl-5 text-gray-600">
              {todayMeetings.map(meeting => (
                <li key={meeting.id} className="mb-2">
                  <span className="font-semibold">{new Date(meeting.activityDateTime.toDate()).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span> - {contacts.find(c => c.id === meeting.contactId)?.name || 'Contacto Desconhecido'} ({contacts.find(c => c.id === meeting.contactId)?.company || 'Empresa Desconhecida'})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* KPI Dashboard Section */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
        <h3 className="text-2xl font-bold text-gray-700 mb-4">Performance dos Comerciais (KPIs)</h3>
        <div className="mb-4">
          <label htmlFor="kpiManagerFilter" className="block text-gray-700 text-sm font-bold mb-2">
            Selecionar Comercial:
          </label>
          <select
            id="kpiManagerFilter"
            value={selectedKpiManager}
            onChange={(e) => setSelectedKpiManager(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            <option value="Todos">Todos os Comerciais</option>
            {leadManagers.map(manager => (
              <option key={manager} value={manager}>{manager}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Leads Captadas por dia */}
          {renderBarChart(
            kpiData.leadsByDay,
            'Leads Captadas por Dia (Últimos 7 dias)',
            (val) => val,
            (label) => new Date(label).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short'})
          )}

          {/* Contactos feitos por dia */}
          {renderBarChart(
            kpiData.contactsByDay,
            'Contactos Feitos por Dia (Últimos 7 dias)',
            (val) => val,
            (label) => new Date(label).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short'})
          )}

          {/* Objetivo Época - Progress Bar */}
          <div className="bg-gray-50 p-4 rounded-lg shadow-inner border border-gray-100 md:col-span-2">
            <h4 className="text-lg font-semibold text-gray-700 mb-2">Objetivo Época (2025/2026)</h4>
            <div className="text-sm text-gray-600 mb-2">
              Alcançado: {kpiData.currentSeasonAmount.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })} / {seasonGoal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 relative">
              <div
                className={`h-4 rounded-full ${kpiData.seasonProgressColor}`}
                style={{ width: `${Math.min(kpiData.seasonProgress, 100)}%` }}
              ></div>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-900">
                {kpiData.seasonProgress.toFixed(1)}%
              </span>
            </div>
            <div className="mt-4 flex items-center">
              <label htmlFor="seasonGoalInput" className="text-sm font-semibold text-gray-700 mr-2">Definir Objetivo Época (€):</label>
              <input
                type="number"
                id="seasonGoalInput"
                value={seasonGoal}
                onChange={(e) => setSeasonGoal(parseFloat(e.target.value) || 0)}
                className="shadow appearance-none border rounded-lg py-1 px-2 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 w-32"
                step="1000"
              />
            </div>
          </div>

          {/* Montante gerado em vendas por mês */}
          {renderBarChart(
            kpiData.amountGeneratedByMonth,
            'Montante Gerado em Vendas por Mês (Últimos 6 meses)',
            (val) => val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }),
            (label) => new Date(label + '-01').toLocaleDateString('pt-PT', { month: 'short', year: '2-digit'})
          )}
        </div>
      </div>
    </div>
  );
}

// Benefits Management Component (New)
function BenefitsManagement({ sponsorshipTiers, onUpdateSponsorshipTiers, contacts, onUpdateContact }) { // Removed allContacts, using contacts directly
  const [tiers, setTiers] = useState(sponsorshipTiers);

  useEffect(() => {
    setTiers(sponsorshipTiers);
  }, [sponsorshipTiers]);

  const handleTierChange = (index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const handleSaveTiers = () => {
    onUpdateSponsorshipTiers(tiers);
  };

  const getTierTagColor = (tierName) => {
    switch (tierName) {
      case "Ouro 🥇": return "bg-yellow-400 text-yellow-900"; // Golden
      case "Prata 🥈": return "bg-gray-400 text-gray-900";   // Silver
      case "Bronze 🥉": return "bg-orange-400 text-orange-900"; // Bronze/Copper
      default: return "bg-gray-200 text-gray-700";
    }
  };

  const handleAssignClientToTier = (tierName, contactId) => {
    const selectedTier = tiers.find(t => t.name === tierName);
    const selectedClient = contacts.find(c => c.id === contactId);

    if (selectedTier && selectedClient) {
      // Check if client is already assigned to this tier
      if (selectedClient.sponsorshipTierName === tierName) {
        alert(`${selectedClient.name} já está atribuído ao pacote ${tierName}.`);
        return;
      }

      // Check if the tier limit has been reached
      const currentClientsInTier = contacts.filter(c => c.sponsorshipTierName === tierName).length;
      if (selectedTier.limit && currentClientsInTier >= selectedTier.limit) {
        alert(`O pacote ${tierName} já atingiu o limite de ${selectedTier.limit} clientes.`);
        return;
      }

      // Remove client from any other tier they might be assigned to
      const previousTierClient = contacts.find(c => c.id === contactId && c.sponsorshipTierName && c.sponsorshipTierName !== tierName);
      if (previousTierClient) {
        onUpdateContact(previousTierClient.id, {
          sponsorshipTierName: '',
          sponsorshipTierBenefits: '',
          sponsorshipTierValue: '',
          sponsorshipTierDuration: ''
        });
      }

      // Assign the new tier to the client
      onUpdateContact(contactId, {
        sponsorshipTierName: selectedTier.name,
        sponsorshipTierBenefits: selectedTier.benefits,
        sponsorshipTierValue: selectedTier.value,
        sponsorshipTierDuration: selectedTier.duration
      });
    }
  };

  const handleRemoveClientFromTier = (contactId) => {
    const clientToRemove = contacts.find(c => c.id === contactId);
    if (clientToRemove) {
      onUpdateContact(clientToRemove.id, {
        sponsorshipTierName: '',
        sponsorshipTierBenefits: '',
        sponsorshipTierValue: '',
        sponsorshipTierDuration: ''
      });
    }
  };


  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Gestão de Pacotes de Patrocínio</h2>

      <div className="space-y-8">
        {tiers.map((tier, index) => {
          const assignedClients = contacts.filter(contact => contact.sponsorshipTierName === tier.name);
          const currentCount = assignedClients.length;
          const limitReached = tier.limit && currentCount >= tier.limit;
          const slotColor = limitReached ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'; // Red if full, green otherwise
          // Filter out clients already assigned to this tier or other tiers if limit is reached
          const unassignedClients = contacts.filter(contact => !contact.sponsorshipTierName || contact.sponsorshipTierName === tier.name);


          return (
            <div key={tier.name} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Pacote {tier.name}
                {tier.limit && (
                  <span className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${slotColor}`}>
                    {currentCount} / {tier.limit} Clientes
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor={`benefits-${index}`} className="block text-gray-700 text-sm font-bold mb-2">Contrapartidas:</label>
                  <textarea
                    id={`benefits-${index}`}
                    value={tier.benefits}
                    onChange={(e) => handleTierChange(index, 'benefits', e.target.value)}
                    rows="3"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  ></textarea>
                </div>
                <div>
                  <label htmlFor={`value-${index}`} className="block text-gray-700 text-sm font-bold mb-2">Valor (€):</label>
                  <input
                    type="number"
                    id={`value-${index}`}
                    value={tier.value}
                    onChange={(e) => handleTierChange(index, 'value', parseFloat(e.target.value) || 0)}
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    step="1000"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor={`duration-${index}`} className="block text-gray-700 text-sm font-bold mb-2">Duração do Contrato:</label>
                <input
                  type="text"
                  id={`duration-${index}`}
                  value={tier.duration}
                  onChange={(e) => handleTierChange(index, 'duration', e.target.value)}
                  className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                />
              </div>

              {/* Client Assignment Section */}
              <div className="mt-6 p-4 bg-gray-100 rounded-lg border border-gray-200">
                <h4 className="text-md font-semibold text-gray-700 mb-3">Atribuir Clientes a este Pacote:</h4>
                <div className="flex items-center space-x-2">
                  <select
                    id={`assign-client-${index}`}
                    onChange={(e) => handleAssignClientToTier(tier.name, e.target.value)}
                    className="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 flex-grow"
                    value="" // Reset select after assignment
                  >
                    <option value="">-- Selecione um Cliente --</option>
                    {unassignedClients.map(client => (
                      // Only show clients not currently assigned to *any* tier, or those already assigned to *this* tier
                      <option
                        key={client.id}
                        value={client.id}
                        disabled={limitReached && client.sponsorshipTierName !== tier.name} // Disable if limit reached and client not already in this tier
                      >
                        {client.name} ({client.company}) {client.sponsorshipTierName && `(Atribuído a ${client.sponsorshipTierName})`}
                      </option>
                    ))}
                  </select>
                </div>
                {assignedClients.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-md font-semibold text-gray-700 mb-2">Clientes Atribuídos:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                      {assignedClients.map(client => (
                        <li key={client.id} className="flex justify-between items-center">
                          {client.name} ({client.company})
                          <button
                            onClick={() => handleRemoveClientFromTier(client.id)}
                            className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs hover:bg-red-200 transition"
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSaveTiers}
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75" /* Lime green button */
        >
          Guardar Níveis de Patrocínio
        </button>
      </div>
    </div>
  );
}

// Database Component (Renamed from ClientArea)
function Database({ contacts, activities, onUpdateContact, onAddActivity, negotiationPhases, leadManagers, setEditingContact, editingContact, showActivityModal, setShowActivityModal, contactForActivity, setContactForActivity, industryList, sponsorshipTiers }) { // Added sponsorshipTiers
  const [selectedContactId, setSelectedContactId] = useState('');
  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const clientActivities = selectedContact ? activities.filter(act => act.contactId === selectedContact.id).sort((a, b) => new Date(b.activityDateTime.toDate()) - new Date(a.activityDateTime.toDate())) : [];

  const handleEditClient = () => {
    if (selectedContact) {
      setEditingContact(selectedContact);
    }
  };

  const handleScheduleActivityForClient = () => {
    if (selectedContact) {
      setContactForActivity(selectedContact);
      setShowActivityModal(true);
    }
  };

  // Helper to get tier color for the tag
  const getTierTagColor = (tierName) => {
    switch (tierName) {
      case "Ouro 🥇": return "bg-yellow-400 text-yellow-900"; // Golden
      case "Prata 🥈": return "bg-gray-400 text-gray-900";   // Silver
      case "Bronze 🥉": return "bg-orange-400 text-orange-900"; // Bronze/Copper
      default: return "bg-gray-200 text-gray-700";
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Clientes</h2> {/* Renamed title */}

      <div className="mb-6">
        <label htmlFor="selectClient" className="block text-gray-700 text-sm font-bold mb-2">Selecionar Cliente:</label>
        <select
          id="selectClient"
          value={selectedContactId}
          onChange={(e) => setSelectedContactId(e.target.value)}
          className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        >
          <option value="">-- Selecione um Cliente --</option>
          {contacts.map(contact => (
            <option key={contact.id} value={contact.id}>{contact.name} ({contact.company})</option>
          ))}
        </select>
      </div>

      {selectedContact ? (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              Ficha do Cliente: {selectedContact.name}
              {selectedContact.sponsorshipTierName && (
                <span className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${getTierTagColor(selectedContact.sponsorshipTierName)}`}>
                  Patrocinador {selectedContact.sponsorshipTierName}
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleEditClient}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out text-sm"
              >
                Editar Cliente
              </button>
              <button
                onClick={handleScheduleActivityForClient}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out text-sm"
              >
                Agendar Atividade
              </button>
            </div>
          </div>

          {editingContact && editingContact.id === selectedContact.id && (
            <div className="mb-6">
              <ContactForm
                initialData={selectedContact}
                onSubmit={(updatedFields) => {
                  onUpdateContact(selectedContact.id, updatedFields);
                  setEditingContact(null); // Exit editing mode
                }}
                onCancel={() => setEditingContact(null)}
                negotiationPhases={negotiationPhases}
                leadManagers={leadManagers}
                industryList={industryList}
                sponsorshipTiers={sponsorshipTiers} /* Pass sponsorshipTiers */
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 mb-6">
            <p><strong>Empresa:</strong> {selectedContact.company}</p>
            <p><strong>Nome Social:</strong> {selectedContact.socialName || 'N/A'}</p>
            <p><strong>NIF:</strong> {selectedContact.nif || 'N/A'}</p>
            <p><strong>Morada Fiscal:</strong> {selectedContact.taxAddress || 'N/A'}</p>
            <p><strong>Email:</strong> {selectedContact.email}</p>
            <p><strong>Telefone:</strong> {selectedContact.phone || 'N/A'}</p>
            <p><strong>LinkedIn:</strong> {selectedContact.linkedin ? <a href={selectedContact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{selectedContact.linkedin}</a> : 'N/A'}</p>
            <p><strong>Valor Negociação:</strong> {selectedContact.negotiationValue ? parseFloat(selectedContact.negotiationValue).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : 'N/A'}</p>
            <p><strong>Fase Negociação:</strong> {selectedContact.negotiationPhase}</p>
            <p><strong>Gerente da Lead:</strong> {selectedContact.leadManager || 'N/A'}</p>
            <p><strong>Próxima Reunião (Antigo):</strong> {selectedContact.meetingDateTime ? new Date(selectedContact.meetingDateTime).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</p>
            <p className="md:col-span-2"><strong>Notas:</strong> {selectedContact.notes || 'N/A'}</p>
            {selectedContact.sponsorshipTierName && (
              <>
                <p className="md:col-span-2"><strong>Pacote de Patrocínio:</strong> {selectedContact.sponsorshipTierName}</p>
                <p className="md:col-span-2"><strong>Contrapartidas do Pacote:</strong> {selectedContact.sponsorshipTierBenefits || 'N/A'}</p>
                <p><strong>Valor do Pacote:</strong> {selectedContact.sponsorshipTierValue ? parseFloat(selectedContact.sponsorshipTierValue).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : 'N/A'}</p>
                <p><strong>Duração do Contrato:</strong> {selectedContact.sponsorshipTierDuration || 'N/A'}</p>
              </>
            )}
          </div>

          <h4 className="text-xl font-bold text-gray-700 mb-4">Atividades Agendadas</h4>
          {clientActivities.length === 0 ? (
            <p className="text-gray-500 italic">Nenhuma atividade agendada para este cliente.</p>
          ) : (
            <ul className="space-y-3">
              {clientActivities.map(activity => (
                <li key={activity.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
                  <p className="font-semibold text-gray-800">{activity.activityType}</p>
                  <p className="text-sm text-gray-600">
                    Data: {new Date(activity.activityDateTime.toDate()).toLocaleDateString('pt-PT')} às {new Date(activity.activityDateTime.toDate()).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {activity.notes && <p className="text-sm text-gray-600 italic">Notas: "{activity.notes}"</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-center text-gray-500 text-lg py-10">
          Por favor, selecione um cliente para ver os seus detalhes e atividades.
        </p>
      )}
    </div>
  );
}


// Overview Component
function Overview({ contacts, negotiationPhases, activities }) {
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'calendar'

  return (
    <div className="p-4">
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setViewMode('map')}
          className={`py-2 px-5 rounded-l-lg font-semibold transition-colors duration-200 ${
            viewMode === 'map' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300' /* Lime green for active */
          }`}
        >
          Mapa de Negociações
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`py-2 px-5 rounded-r-lg font-semibold transition-colors duration-200 ${
            viewMode === 'calendar' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300' /* Lime green for active */
          }`}
        >
          Calendário Semanal
        </button>
      </div>

      {viewMode === 'map' ? (
        <NegotiationPhaseChart contacts={contacts} negotiationPhases={negotiationPhases} />
      ) : (
        <WeeklyCalendar contacts={contacts} activities={activities} />
      )}
    </div>
  );
}


// Contact Form Component
function ContactForm({ onSubmit, onCancel, initialData = {}, negotiationPhases, leadManagers, industryList = [], sponsorshipTiers = [] }) { // Added sponsorshipTiers = []
  const [name, setName] = useState(initialData.name || '');
  const [company, setCompany] = useState(initialData.company || '');
  const [email, setEmail] = useState(initialData.email || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [linkedin, setLinkedin] = useState(initialData.linkedin || ''); // New state for LinkedIn
  const [socialName, setSocialName] = useState(initialData.socialName || '');
  const [nif, setNif] = useState(initialData.nif || '');
  const [taxAddress, setTaxAddress] = useState(initialData.taxAddress || '');
  const [industry, setIndustry] = useState(initialData.industry || industryList[0]); // New state for industry
  const [leadStatus, setLeadStatus] = useState(initialData.leadStatus || 'Cold'); // New state for lead status
  const [negotiationValue, setNegotiationValue] = useState(initialData.negotiationValue || '');
  const [negotiationPhase, setNegotiationPhase] = useState(initialData.negotiationPhase || negotiationPhases[0]);
  const [leadManager, setLeadManager] = useState(initialData.leadManager || leadManagers[0]);
  const [sponsorshipTierName, setSponsorshipTierName] = useState(initialData.sponsorshipTierName || ''); // New state for selected tier name
  const [sponsorshipTierBenefits, setSponsorshipTierBenefits] = useState(initialData.sponsorshipTierBenefits || ''); // New state for selected tier benefits
  const [sponsorshipTierValue, setSponsorshipTierValue] = useState(initialData.sponsorshipTierValue || ''); // New state for selected tier value
  const [sponsorshipTierDuration, setSponsorshipTierDuration] = useState(initialData.sponsorshipTierDuration || ''); // New state for selected tier duration
  const [meetingDateTime, setMeetingDateTime] = useState(initialData.meetingDateTime || ''); // This is for the *next* meeting, not a historical activity
  const [notes, setNotes] = useState(initialData.notes || '');

  // Effect to update sponsorship tier details when a tier is selected
  useEffect(() => {
    const selectedTier = sponsorshipTiers.find(tier => tier.name === sponsorshipTierName);
    if (selectedTier) {
      setSponsorshipTierBenefits(selectedTier.benefits);
      setSponsorshipTierValue(selectedTier.value);
      setSponsorshipTierDuration(selectedTier.duration);
    } else {
      setSponsorshipTierBenefits('');
      setSponsorshipTierValue('');
      setSponsorshipTierDuration('');
    }
  }, [sponsorshipTierName, sponsorshipTiers]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !company || !email) {
      alert("Por favor, preencha os campos obrigatórios: Nome, Empresa e Email.");
      return;
    }
    onSubmit({
      name, company, email, phone, linkedin, socialName, nif, taxAddress, industry, leadStatus, // Include leadStatus
      negotiationValue, negotiationPhase, leadManager, meetingDateTime, notes,
      sponsorshipTierName, sponsorshipTierBenefits, sponsorshipTierValue, sponsorshipTierDuration // Include new tier fields
    });
  };

  const leadStatusOptions = ["Cold", "Warm", "Hot"];

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8 border border-gray-200 w-full md:max-w-4xl mx-auto"> {/* Adjusted max-w to 4xl */}
      <h3 className="text-xl font-semibold text-gray-700 mb-4">{initialData.id ? 'Editar Contacto' : 'Adicionar Novo Contacto'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Nome do Contacto*</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          />
        </div>
        <div>
          <label htmlFor="company" className="block text-gray-700 text-sm font-bold mb-2">Empresa*</label>
          <input
            type="text"
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email*</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-gray-700 text-sm font-bold mb-2">Telefone</label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="linkedin" className="block text-gray-700 text-sm font-bold mb-2">LinkedIn (URL)</label>
          <input
            type="url"
            id="linkedin"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="Ex: https://linkedin.com/in/nome"
          />
        </div>
        <div>
          <label htmlFor="socialName" className="block text-gray-700 text-sm font-bold mb-2">Nome Social</label>
          <input
            type="text"
            id="socialName"
            value={socialName}
            onChange={(e) => setSocialName(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          />
        </div>
        <div>
          <label htmlFor="nif" className="block text-gray-700 text-sm font-bold mb-2">NIF</label>
          <input
            type="text"
            id="nif"
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          />
        </div>
        <div className="md:col-span-2"> {/* Span across two columns for better layout */}
          <label htmlFor="taxAddress" className="block text-gray-700 text-sm font-bold mb-2">Morada Fiscal</label>
          <input
            type="text"
            id="taxAddress"
            value={taxAddress}
            onChange={(e) => setTaxAddress(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="industry" className="block text-gray-700 text-sm font-bold mb-2">Sector/Indústria</label>
          <select
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            {industryList.map(industryOption => (
              <option key={industryOption} value={industryOption}>{industryOption}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="leadStatus" className="block text-gray-700 text-sm font-bold mb-2">Status da Lead</label>
          <select
            id="leadStatus"
            value={leadStatus}
            onChange={(e) => setLeadStatus(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            {leadStatusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="negotiationValue" className="block text-gray-700 text-sm font-bold mb-2">Valor da Negociação (€)</label>
          <input
            type="number"
            id="negotiationValue"
            value={negotiationValue}
            onChange={(e) => setNegotiationValue(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            step="0.01"
          />
        </div>
        <div>
          <label htmlFor="negotiationPhase" className="block text-gray-700 text-sm font-bold mb-2">Fase da Negociação</label>
          <select
            id="negotiationPhase"
            value={negotiationPhase}
            onChange={(e) => setNegotiationPhase(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            {negotiationPhases.map(phase => (
              <option key={phase} value={phase}>{phase}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="leadManager" className="block text-gray-700 text-sm font-bold mb-2">Gerente da Lead</label>
          <select
            id="leadManager"
            value={leadManager}
            onChange={(e) => setLeadManager(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            {leadManagers.map(manager => (
              <option key={manager} value={manager}>{manager}</option>
            ))}
          </select>
        </div>
        {/* Removed Sponsorship Tier selection from contact creation/edit form */}
        {/* This will be managed in the Sponsorship section directly */}
        <div>
          <label htmlFor="meetingDateTime" className="block text-gray-700 text-sm font-bold mb-2">Agendar Nova Ação</label> {/* Renamed field */}
          <input
            type="datetime-local"
            id="meetingDateTime"
            value={meetingDateTime}
            onChange={(e) => setMeetingDateTime(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          />
        </div>
      </div>
      <div className="mb-6">
        <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">Notas</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows="3"
          className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        ></textarea>
      </div>
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75" /* Lime green button */
        >
          {initialData.id ? 'Guardar Alterações' : 'Adicionar Contacto'}
        </button>
      </div>
    </form>
  );
}

// Contact Card Component
function ContactCard({ contact, onUpdate, onDelete, onEdit, isEditing, negotiationPhases, leadManagers, setEditingContact, onGenerateContract, onScheduleActivity }) {
  const getPhaseColor = (phase) => {
    switch (phase) {
      case "Contacto Inicial": return "bg-blue-100 text-blue-800";
      case "Proposta Enviada": return "bg-yellow-100 text-yellow-800";
      case "Negociação": return "bg-purple-100 text-purple-800";
      case "Fechado": return "bg-green-100 text-green-800";
      case "Perdido": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Helper to get lead status color
  const getLeadStatusColor = (status) => {
    switch (status) {
      case "Cold": return "bg-blue-200 text-blue-800";
      case "Warm": return "bg-yellow-200 text-yellow-800";
      case "Hot": return "bg-red-200 text-red-800";
      default: return "bg-gray-200 text-gray-700";
    }
  };

  const handlePhaseChange = (e) => {
    onUpdate(contact.id, { negotiationPhase: e.target.value });
  };

  const generateGoogleCalendarLink = () => {
    if (!contact.meetingDateTime) {
      alert("Por favor, defina uma data e hora para a reunião antes de agendar no Google Calendar.");
      return;
    }

    const start = new Date(contact.meetingDateTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // Assume 1 hour meeting for now

    const formatDateTime = (date) => {
      return date.toISOString().replace(/[-:]|\.\d{3}/g, '');
    };

    const title = encodeURIComponent(`Reunião de Patrocínio: ${contact.company} - ${contact.name}`);
    const details = encodeURIComponent(`Notas: ${contact.notes || 'N/A'}\n\nGerente da Lead: ${contact.leadManager || 'N/A'}`);
    const guests = encodeURIComponent(contact.email);
    const dates = `${formatDateTime(start)}/${formatDateTime(end)}`;

    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&add=${guests}`;
    window.open(calendarUrl, '_blank');
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-400 transform scale-105 transition duration-200">
        <ContactForm
          initialData={contact}
          onSubmit={(updatedFields) => {
            onUpdate(contact.id, updatedFields);
            setEditingContact(null); // Exit editing mode after update
          }}
          onCancel={() => setEditingContact(null)} // Cancel editing
          negotiationPhases={negotiationPhases}
          leadManagers={leadManagers}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-200 relative">
      <div className={`absolute top-0 right-0 m-3 px-3 py-1 rounded-full text-xs font-semibold ${getPhaseColor(contact.negotiationPhase)}`}>
        {/* Display the negotiation phase at the top right */}
        {contact.negotiationPhase}
      </div>
      {contact.leadStatus && (
        <div className={`absolute top-0 left-0 mt-3 ml-3 px-3 py-1 rounded-full text-xs font-semibold ${getLeadStatusColor(contact.leadStatus)}`}> {/* Adjusted position with mt and ml */}
          {contact.leadStatus}
        </div>
      )}
      {/* Display company name prominently */}
      <h3 className="text-xl font-bold text-gray-800 mt-8 mb-2">{contact.company}</h3> {/* Added mt-8 to push company name down */}
      {/* Display contact name below company name */}
      <p className="text-gray-600 mb-1">Contacto: {contact.name}</p>

      {/* Keeping only essential info or actions */}

      <div className="flex justify-end gap-2 mt-4 flex-wrap">
        {contact.meetingDateTime && (
          <button
            onClick={generateGoogleCalendarLink}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 text-sm"
          >
            Agendar no Google Calendar
          </button>
        )}
        <button
          onClick={() => onScheduleActivity(contact)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 text-sm"
        >
          Agendar Atividade
        </button>
        <button
          onClick={() => onGenerateContract(contact)}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 text-sm"
        >
          Gerar Contrato
        </button>
        <button
          onClick={onEdit}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75 text-sm" /* Increased px-6 for wider button */
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(contact)}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 text-sm"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

// Contact List View Component
function ContactListView({ contacts, leadManagers, filterLeadManager, setFilterLeadManager, industryList, filterIndustry, setFilterIndustry }) { // Receive industryList and filter states
  const filteredByLeadManager = filterLeadManager === 'Todos'
    ? contacts
    : contacts.filter(contact => contact.leadManager === filterLeadManager);

  const filteredContacts = filterIndustry === 'Todos'
    ? filteredByLeadManager
    : filteredByLeadManager.filter(contact => contact.industry === filterIndustry);

  // Function to prepare email with template
  const handleEmailTemplateClick = (contact, templateType) => {
    let subject = '';
    let body = '';

    switch (templateType) {
      case 'cold':
        subject = `Proposta de Patrocínio para ${contact.company}`;
        body = `Olá ${contact.name},\n\nEspero que este e-mail o encontre bem.\n\nGostaria de apresentar uma oportunidade de patrocínio que pode ser muito benéfica para a ${contact.company}. Acreditamos que a nossa proposta se alinha perfeitamente com os vossos objetivos de [mencionar objetivo, ex: visibilidade da marca, envolvimento com a comunidade].\n\nPodemos agendar uma breve chamada para discutir como podemos colaborar?\n\nCom os melhores cumprimentos,\n[Seu Nome]`;
        break;
      case 'followup':
        subject = `Seguimento: Reunião com ${contact.company}`;
        body = `Olá ${contact.name},\n\nEspero que esteja tudo bem.\n\nEstou a fazer o seguimento da nossa última conversa/reunião sobre [tópico da reunião]. Gostaria de saber se teve oportunidade de rever a nossa proposta e se tem alguma questão.\n\nEstou à disposição para qualquer esclarecimento.\n\nCom os melhores cumprimentos,\n[Seu Nome]`;
        break;
      case 'closedeal':
        subject = `Excelente Notícia: Patrocínio Fechado com ${contact.company}!`;
        body = `Olá ${contact.name},\n\nÉ com grande entusiasmo que confirmo o fecho do nosso acordo de patrocínio! Estamos muito entusiasmados com esta parceria e acreditamos que será um sucesso para ambas as partes.\n\nNos próximos dias, entraremos em contacto para dar os próximos passos e iniciar a implementação.\n\nMuito obrigado pela sua confiança e colaboração.\n\nCom os melhores cumprimentos,\n[Seu Nome]`;
        break;
      default:
        subject = `Contacto de ${contact.company}`;
        body = `Olá ${contact.name},\n\n`;
    }

    window.open(`mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };


  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Contactos</h2> {/* Renamed title */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="filterLeadManager" className="block text-gray-700 text-sm font-bold mb-2">
            Filtrar por Gerente da Lead:
          </label>
          <select
            id="filterLeadManager"
            value={filterLeadManager}
            onChange={(e) => setFilterLeadManager(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            <option value="Todos">Todos</option>
            {leadManagers.map(manager => (
              <option key={manager} value={manager}>{manager}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filterIndustry" className="block text-gray-700 text-sm font-bold mb-2">
            Filtrar por Sector/Indústria:
          </label>
          <select
            id="filterIndustry"
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            <option value="Todos">Todos</option>
            {industryList.map(industryOption => (
              <option key={industryOption} value={industryOption}>{industryOption}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredContacts.length === 0 ? (
        <p className="text-center text-gray-500 text-lg py-10">
          Nenhum contacto para exibir na lista.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome Contacto
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empresa
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome Social
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NIF
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Morada Fiscal
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telefone
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LinkedIn
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Neg.
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fase Negociação
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gerente Lead
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Próxima Reunião (Antigo)
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações de Email
                </th> {/* New table header for email actions */}
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {contact.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.company}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.socialName || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.nif || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.taxAddress || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.phone || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500">
                    {contact.linkedin ? <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="hover:underline">Ver Perfil</a> : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.negotiationValue ? parseFloat(contact.negotiationValue).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPhaseColorForList(contact.negotiationPhase)}`}>
                      {contact.negotiationPhase}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.leadManager || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {contact.meetingDateTime ? new Date(contact.meetingDateTime).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEmailTemplateClick(contact, 'cold')}
                        title="Enviar Cold E-mail"
                        className="p-2 rounded-full bg-[#BFFF00] text-gray-900 shadow-sm hover:bg-green-300 transition" /* Lime green button */
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.57 6a3 3 0 0 1-3.86 0l-8.57-6Z" />
                          <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 6.868a1.5 1.5 0 0 0 1.972 0l9.714-6.868Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEmailTemplateClick(contact, 'followup')}
                        title="Enviar Follow-up"
                        className="p-2 rounded-full bg-[#BFFF00] text-gray-900 shadow-sm hover:bg-green-300 transition" /* Lime green button */
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm.53 5.47a.75.75 0 0 0-1.06 0L8.22 10.53a.75.75 0 0 0 0 1.06l3.25 3.25a.75.75 0 0 0 1.06-1.06l-1.97-1.97h6.69a.75.75 0 0 0 0-1.5h-6.69l1.97-1.97a.75.75 0 0 0 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEmailTemplateClick(contact, 'closedeal')}
                        title="Enviar E-mail de Fecho"
                        className="p-2 rounded-full bg-[#BFFF00] text-gray-900 shadow-sm hover:bg-green-300 transition" /* Lime green button */
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M19.952 1.304A.75.75 0 0 0 19.232.25h-3.837a.75.75 0 0 0-.722.568l-1.876 8.154a.75.75 0 0 0 .159.792l6.49 6.49a.75.75 0 0 0 1.06 0l1.958-1.959a.75.75 0 0 0 0-1.06L20.007 2.568a.75.75 0 0 0-.055-1.264Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Helper function for ContactListView phase colors
const getPhaseColorForList = (phase) => {
  switch (phase) {
    case "Contacto Inicial": return "bg-blue-100 text-blue-800";
    case "Proposta Enviada": return "bg-yellow-100 text-yellow-800";
    case "Negociação": return "bg-purple-100 text-purple-800";
    case "Fechado": return "bg-green-100 text-green-800";
    case "Perdido": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};


// Negotiation Phase Chart Component (Map)
function NegotiationPhaseChart({ contacts, negotiationPhases }) {
  // Group contacts by negotiation phase
  const contactsByPhase = negotiationPhases.reduce((acc, phase) => {
    acc[phase] = contacts.filter(contact => contact.negotiationPhase === phase);
    return acc;
  }, {});

  // Calculate total contacts for percentage
  const totalContacts = contacts.length;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Mapa de Negociações por Fase</h2>
      {contacts.length === 0 ? (
        <p className="text-center text-gray-500 text-lg py-10">
          Nenhum contacto para exibir no mapa de negociações.
        </p>
      ) : (
        <div className="flex flex-col items-center space-y-4"> {/* Changed to flex-col for vertical funnels */}
          {negotiationPhases.map(phase => {
            const phaseContacts = contactsByPhase[phase];
            const count = phaseContacts.length;
            const percentage = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
            const phaseColor = getPhaseColorForChartTitle(phase); // Reusing helper for consistent colors

            return (
              <div key={phase} className="w-full max-w-xl bg-gray-50 p-4 rounded-lg shadow-inner border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h3 className={`text-lg font-bold ${phaseColor}`}>
                    {phase} ({count})
                  </h3>
                  <span className="text-gray-700 text-sm">{percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-full rounded-full ${phaseColor}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                {phaseContacts.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 mt-2">
                    {phaseContacts.map(contact => (
                      <li key={contact.id}>
                        <span className="font-semibold">{contact.company}</span> - {contact.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper function for NegotiationPhaseChart title colors
const getPhaseColorForChartTitle = (phase) => {
  switch (phase) {
    case "Contacto Inicial": return "text-blue-700 bg-blue-100"; // Added bg for funnel bar
    case "Proposta Enviada": return "text-yellow-700 bg-yellow-100"; // Added bg for funnel bar
    case "Negociação": return "text-purple-700 bg-purple-100"; // Added bg for funnel bar
    case "Fechado": return "text-green-700 bg-green-100"; // Added bg for funnel bar
    case "Perdido": return "text-red-700 bg-red-100"; // Added bg for funnel bar
    default: return "text-gray-700 bg-gray-100"; // Added bg for funnel bar
  }
};

// Weekly Calendar Component
function WeeklyCalendar({ contacts, activities }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday of the current week
    const start = new Date(today.setDate(diff));
    start.setHours(0, 0, 0, 0); // Normalize to start of day
    return start;
  });

  const getWeekDays = (startOfWeek) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const weekDays = getWeekDays(currentWeekStart);

  const activitiesByDay = weekDays.reduce((acc, day) => {
    acc[day.toISOString().split('T')[0]] = activities.filter(activity => {
      if (!activity.activityDateTime) return false;
      const activityDate = new Date(activity.activityDateTime.toDate());
      return activityDate.getDate() === day.getDate() &&
             activityDate.getMonth() === day.getMonth() &&
             activityDate.getFullYear() === day.getFullYear();
    }).sort((a, b) => new Date(a.activityDateTime.toDate()) - new Date(b.activityDateTime.toDate()));
    return acc;
  }, {});

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Calendário Semanal de Atividades</h2>
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={goToPreviousWeek}
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75" /* Lime green button */
        >
          Semana Anterior
        </button>
        <span className="text-lg font-semibold text-gray-800">
          {weekDays[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} - {weekDays[6].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={goToNextWeek}
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75" /* Lime green button */
        >
          Próxima Semana
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map(day => {
          const dayKey = day.toISOString().split('T')[0];
          const dayActivities = activitiesByDay[dayKey] || [];
          return (
            <div
              key={dayKey}
              className={`bg-white p-4 rounded-lg shadow-md border ${isToday(day) ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}`}
            >
              <h4 className={`text-center font-bold mb-2 ${isToday(day) ? 'text-blue-700' : 'text-gray-700'}`}>
                {day.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' })}
              </h4>
              {dayActivities.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Sem atividades</p>
              ) : (
                <ul className="space-y-1">
                  {dayActivities.map(activity => (
                    <li key={activity.id} className="text-sm text-gray-700 bg-gray-50 p-2 rounded-md">
                      <span className="font-semibold">{new Date(activity.activityDateTime.toDate()).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span><br/>
                      {contacts.find(c => c.id === activity.contactId)?.name || 'Contacto Desconhecido'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// Activity Form Modal Component
function ActivityFormModal({ contact, onSubmit, onClose }) {
  const [activityType, setActivityType] = useState('Follow-Up');
  const [customActivityType, setCustomActivityType] = useState('');
  const [activityDateTime, setActivityDateTime] = useState('');
  const [notes, setNotes] = useState('');

  const activityTypes = [
    "Follow-Up",
    "Reunião Presencial",
    "Reunião Virtual",
    "Evento",
    "Outro"
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activityDateTime) {
      alert("Por favor, preencha a data e hora da atividade.");
      return;
    }
    const finalActivityType = activityType === 'Outro' ? customActivityType : activityType;
    if (activityType === 'Outro' && !customActivityType) {
      alert("Por favor, especifique o tipo de atividade 'Outro'.");
      return;
    }

    onSubmit({
      contactId: contact.id,
      contactName: contact.name,
      contactCompany: contact.company,
      activityType: finalActivityType,
      activityDateTime: new Date(activityDateTime), // Convert to Date object for Firestore Timestamp
      notes: notes
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Agendar Atividade para {contact.name} ({contact.company})</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="activityType" className="block text-gray-700 text-sm font-bold mb-2">Tipo de Atividade</label>
            <select
              id="activityType"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            >
              {activityTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {activityType === 'Outro' && (
            <div className="mb-4">
              <label htmlFor="customActivityType" className="block text-gray-700 text-sm font-bold mb-2">Especificar Tipo</label>
              <input
                type="text"
                id="customActivityType"
                value={customActivityType}
                onChange={(e) => setCustomActivityType(e.target.value)}
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                placeholder="Ex: Envio de Proposta"
                required
              />
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="activityDateTime" className="block text-gray-700 text-sm font-bold mb-2">Data e Hora</label>
            <input
              type="datetime-local"
              id="activityDateTime"
              value={activityDateTime}
              onChange={(e) => setActivityDateTime(e.target.value)}
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">Notas da Atividade</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            ></textarea>
          </div>
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
            >
              Agendar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Contract Templates Component
function ContractTemplates({ templateText, onSaveTemplate }) {
  const [currentTemplate, setCurrentTemplate] = useState(templateText);

  // Update internal state when prop changes (e.g., loaded from Firestore)
  useEffect(() => {
    setCurrentTemplate(templateText);
  }, [templateText]);

  const handleSave = () => {
    onSaveTemplate(currentTemplate);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Modelos de Contrato</h2>
      <p className="text-gray-600 mb-4">
        Defina o seu modelo de contrato aqui. Utilize os seguintes marcadores de posição (placeholders) para que os dados do contacto sejam preenchidos automaticamente:
      </p>
      <ul className="list-disc list-inside bg-gray-100 p-4 rounded-lg mb-6 text-sm text-gray-700">
        <li><code>{'{{NOME_SOCIAL}}'}</code>: Nome social da empresa do contacto</li>
        <li><code>{'{{NIF}}'}</code>: NIF da empresa do contacto</li>
        <li><code>{'{{MORADA_FISCAL}}'}</code>: Morada fiscal da empresa do contacto</li>
        <li><code>{'{{VALOR_NEGOCIACAO}}'}</code>: Valor numérico da negociação (ex: "1.234,56")</li>
        <li><code>{'{{VALOR_NEGOCIACAO_POR_EXTENSO}}'}</code>: Valor da negociação por extenso (ex: "mil duzentos e trinta e quatro euros e cinquenta e seis cêntimos")</li>
        <li><code>{'{{NOME_CONTACTO}}'}</code>: Nome do contacto</li>
        <li><code>{'{{EMPRESA}}'}</code>: Nome da empresa do contacto</li>
        <li><code>{'{{EMAIL}}'}</code>: Email do contacto</li>
        <li><code>{'{{TELEFONE}}'}</code>: Telefone do contacto</li>
        <li><code>{'{{GERENTE_LEAD}}'}</code>: Gerente da lead atribuído</li>
        <li><code>{'{{NOTAS}}'}</code>: Notas da negociação</li>
        <li><code>{'{{FASE_NEGOCIACAO}}'}</code>: Fase atual da negociação</li>
        <li><code>{'{{DATA_REUNIAO}}'}</code>: Data e hora da próxima reunião (do campo antigo do contacto)</li>
        <li><code>{'{{DATA_ATUAL}}'}</code>: Data atual (do momento da geração do contrato)</li>
      </ul>
      <textarea
        className="w-full h-96 p-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        value={currentTemplate}
        onChange={(e) => setCurrentTemplate(e.target.value)}
        placeholder="Cole ou escreva o seu modelo de contrato aqui..."
      ></textarea>
      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
        >
          Guardar Modelo
        </button>
      </div>
    </div>
  );
}

// Contract Display Modal Component
function ContractDisplayModal({ contractText, onClose }) {
  const contentRef = useRef(null); // Create a ref for the content to be printed

  // Function to copy formatted HTML to clipboard for Word/Google Docs
  const copyFormattedHtmlToClipboard = () => {
    // Create a temporary div to hold the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contractText;

    // Apply the desired styles for copying to Word/Google Docs
    tempDiv.style.fontFamily = 'Arial, sans-serif';
    tempDiv.style.lineHeight = '1.6';
    tempDiv.style.textAlign = 'justify';
    tempDiv.style.fontSize = '11pt';
    tempDiv.style.color = '#000000';
    tempDiv.style.padding = '20mm'; // Simulate document margins

    // Append to body, select, copy, then remove
    document.body.appendChild(tempDiv);
    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('copy');
    selection.removeAllRanges();
    document.body.removeChild(tempDiv);
    alert('Conteúdo formatado copiado para a área de transferência! Cole no Google Docs ou Word.');
  };

  const downloadTxtContract = () => {
    const filename = "Contrato_Patrocinio.txt";
    // Create a temporary div to parse HTML and get plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contractText;
    const plainText = tempDiv.innerText;

    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href); // Clean up the URL object
  };

  const downloadPdfContract = () => {
    if (contentRef.current) {
      // Load html2pdf.js dynamically if not already loaded
      if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => {
          // Once script is loaded, proceed with PDF generation
          const opt = {
            margin:       [20, 20, 20, 20], // Top, Left, Bottom, Right margins in mm
            filename:     'Contrato_Patrocinio.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, logging: true, dpi: 192, letterRendering: true }, // Added logging and dpi for better quality
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          html2pdf().from(contentRef.current).set(opt).save();
        };
        document.body.appendChild(script);
      } else {
        // If html2pdf.js is already loaded
        const opt = {
          margin:       [20, 20, 20, 20], // Top, Left, Bottom, Right margins in mm
          filename:     'Contrato_Patrocinio.pdf',
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, logging: true, dpi: 192, letterRendering: true }, // Added logging and dpi for better quality
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(contentRef.current).set(opt).save();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-3xl w-full mx-auto max-h-[95vh] flex flex-col">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Contrato Gerado</h3>
        {/* Content to be printed as PDF */}
        <div
          ref={contentRef}
          className="flex-grow overflow-y-auto text-base"
          style={{
            fontFamily: 'Arial, sans-serif', // Fallback for display in modal
            lineHeight: '1.6', // Fallback for display in modal
            textAlign: 'justify', // Fallback for display in modal
            backgroundColor: '#ffffff', // Explicitly white background
            boxSizing: 'border-box',
            margin: '0 auto', // Center the content horizontally in the modal preview
            color: '#000000',
            padding: '20mm' // Apply padding for modal preview
          }}
        >
          {/* Render HTML content directly */}
          <div dangerouslySetInnerHTML={{ __html: contractText }} />
        </div>
        <div className="flex justify-end gap-4 mt-6 flex-shrink-0">
          <button
            onClick={downloadPdfContract}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
          >
            Descarregar Contrato (.pdf)
          </button>
          <button
            onClick={downloadTxtContract}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
          >
            Descarregar Contrato (.txt)
          </button>
          <button
            onClick={copyFormattedHtmlToClipboard}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          >
            Copiar para Google Docs/Word
          </button>
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}


// Delete Confirmation Modal Component
function DeleteConfirmationModal({ contactName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full mx-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Confirmar Eliminação</h3>
        <p className="text-gray-700 mb-6">Tem a certeza que deseja eliminar o contacto <span className="font-semibold">"{contactName}"</span>? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
