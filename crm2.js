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
        ${activeTab === tabId ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'text-white hover:bg-[#003300]'}
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
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(null);
          }
          setLoadingFirebase(false); // Set loading to false after auth state is determined
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
        <div className="w-full md:w-64 bg-[#002200] text-white flex flex-col p-4 shadow-lg md:min-h-screen">
          <h1 className="text-3xl font-extrabold text-center text-white mb-6 drop-shadow-sm">
            CRM SAD
          </h1>
          {userId && (
            <p className="text-center text-sm text-gray-200 mb-6">
              ID do Utilizador: <span className="font-mono bg-gray-700 px-2 py-1 rounded-md text-xs">{userId}</span>
            </p>
          )}
          <nav className="flex flex-col space-y-2">
            <TabButton label="Início" tabId="inicio" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Leads" tabId="dashboard" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Contactos" tabId="contactList" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Clientes" tabId="clientes" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Processos" tabId="overview" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Campanhas" tabId="campaigns" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Sponsorship" tabId="benefits" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Modelos de Contrato" tabId="contractTemplates" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton label="Equipa Comercial" tabId="salesTeam" activeTab={activeTab} setActiveTab={setActiveTab} />
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
function SponsorshipCRM({ activeTab, setActiveTab }) {
  const { db, userId } = useContext(FirebaseContext);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  const [generatedContracts, setGeneratedContracts] = useState([]);
  const [contractClauses, setContractClauses] = useState([]);
  const [emailCampaigns, setEmailCampaigns] = useState([]);
  const [newsFeedItems, setNewsFeedItems] = useState([]);
  const [companyUpdates, setCompanyUpdates] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [filterPhase, setFilterPhase] = useState('Todos');
  const [filterLeadManager, setFilterLeadManager] = useState('Todos');
  const [filterIndustry, setFilterIndustry] = useState('Todos');
  const [contractTemplate, setContractTemplate] = useState('');
  const [showContractModal, setShowContractModal] = useState(false);
  const [generatedContractContent, setGeneratedContractContent] = useState('');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [contactForActivity, setContactForActivity] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [contactForEmail, setContactForEmail] = useState(null);
  const [sponsorshipTiers, setSponsorshipTiers] = useState([]);
  const [counterparts, setCounterparts] = useState([]);
  const [activeSponsorshipSubTab, setActiveSponsorshipSubTab] = useState('packages');

  const [showGenerateContractOptionsModal, setShowGenerateContractOptionsModal] = useState(false);
  const [contactForContractGeneration, setContactForContractGeneration] = useState(null);


  // Negotiation phases
  const negotiationPhases = [
    "Contacto Inicial",
    "Proposta Enviada",
    "Negociação",
    "Fechado",
    "Perdido"
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

{{CLAUSULAS_ADICIONAIS}}

<div class="page-break-before signature-block" style="margin-top: 80px;">
    <p>E, por estarem assim justos e contratados, as partes assinam o presente Contrato em duas vias de igual teor e forma.</p>

    <p style="margin-top: 50px;">___________________________      ___________________________<br>
    [Seu Nome/Representante]          [Nome do Contacto]<br>
    Patrocinado                       Patrocinador</p>
</div>
`;


  useEffect(() => {
    if (!db || !userId) return;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Fetch contacts
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

    // Fetch activities
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

    // Fetch sales reps
    const salesRepsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/salesReps`);
    const qSalesReps = query(salesRepsCollectionRef, orderBy('name'));

    const unsubscribeSalesReps = onSnapshot(qSalesReps, (snapshot) => {
      const fetchedSalesReps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSalesReps(fetchedSalesReps);
    }, (error) => {
      console.error("Erro ao obter comerciais:", error);
    });

    // Fetch generated contracts
    const generatedContractsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/generatedContracts`);
    const qGeneratedContracts = query(generatedContractsCollectionRef, orderBy('generatedAt', 'desc'));

    const unsubscribeGeneratedContracts = onSnapshot(qGeneratedContracts, (snapshot) => {
      const fetchedGeneratedContracts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGeneratedContracts(fetchedGeneratedContracts);
    }, (error) => {
      console.error("Erro ao obter contratos gerados:", error);
    });

    // Fetch contract clauses
    const contractClausesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/contractClauses`);
    const qContractClauses = query(contractClausesCollectionRef, orderBy('title'));

    const unsubscribeContractClauses = onSnapshot(qContractClauses, (snapshot) => {
      const fetchedContractClauses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setContractClauses(fetchedContractClauses);
    }, (error) => {
      console.error("Erro ao obter cláusulas de contrato:", error);
    });

    // Fetch email campaigns
    const emailCampaignsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/emailCampaigns`);
    const qEmailCampaigns = query(emailCampaignsCollectionRef, orderBy('sentAt', 'desc'));

    const unsubscribeEmailCampaigns = onSnapshot(qEmailCampaigns, (snapshot) => {
      const fetchedCampaigns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmailCampaigns(fetchedCampaigns);
    }, (error) => {
      console.error("Erro ao obter campanhas de email:", error);
    });

    // Fetch news feed items
    const newsFeedItemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/newsFeedItems`);
    const qNewsFeedItems = query(newsFeedItemsCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribeNewsFeedItems = onSnapshot(qNewsFeedItems, (snapshot) => {
      const fetchedNewsItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNewsFeedItems(fetchedNewsItems);
    }, (error) => {
      console.error("Erro ao obter itens do newsfeed:", error);
    });

    // Fetch company updates (sub-collection)
    // This will be fetched per contact in the Database component, no global listener needed here.


    // Fetch sponsorship tiers
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

    // Fetch counterparts
    const counterpartsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/counterparts`);
    const qCounterparts = query(counterpartsCollectionRef, orderBy('createdAt', 'asc')); // Order by creation to maintain C1, C2 order

    const unsubscribeCounterparts = onSnapshot(qCounterparts, (snapshot) => {
        const fetchedCounterparts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setCounterparts(fetchedCounterparts);
    }, (error) => {
        console.error("Erro ao obter contrapartidas:", error);
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
      unsubscribeSalesReps(); // Cleanup sales reps listener
      unsubscribeGeneratedContracts(); // Cleanup generated contracts listener
      unsubscribeContractClauses(); // Cleanup contract clauses listener
      unsubscribeEmailCampaigns(); // Cleanup email campaigns listener
      unsubscribeNewsFeedItems(); // Cleanup news feed items listener
      unsubscribeTiers(); // Cleanup tiers listener
      unsubscribeCounterparts(); // Cleanup counterparts listener
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

  const handleAddSalesRep = async (salesRep) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/salesReps`), {
        ...salesRep,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert('Comercial adicionado com sucesso!');
    } catch (e) {
      console.error("Erro ao adicionar comercial:", e);
      alert('Erro ao adicionar comercial.');
    }
  };

  const handleUpdateSalesRep = async (id, updatedFields) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const salesRepRef = doc(db, `artifacts/${appId}/users/${userId}/salesReps`, id);
      await updateDoc(salesRepRef, {
        ...updatedFields,
        updatedAt: serverTimestamp()
      });
      alert('Comercial atualizado com sucesso!');
    } catch (e) {
      console.error("Erro ao atualizar comercial:", e);
      alert('Erro ao atualizar comercial.');
    }
  };

  const handleDeleteSalesRep = async (id) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const salesRepRef = doc(db, `artifacts/${appId}/users/${userId}/salesReps`, id);
      await deleteDoc(salesRepRef);
      alert('Comercial eliminado com sucesso!');
    } catch (e) {
      console.error("Erro ao eliminar comercial:", e);
      alert('Erro ao eliminar comercial.');
    }
  };

  const handleAddClause = async (clause) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/contractClauses`), {
        ...clause,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert('Cláusula adicionada com sucesso!');
    } catch (e) {
      console.error("Erro ao adicionar cláusula:", e);
      alert('Erro ao adicionar cláusula.');
    }
  };

  const handleUpdateClause = async (id, updatedFields) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const clauseRef = doc(db, `artifacts/${appId}/users/${userId}/contractClauses`, id);
      await updateDoc(clauseRef, {
        ...updatedFields,
        updatedAt: serverTimestamp()
      });
      alert('Cláusula atualizada com sucesso!');
    } catch (e) {
      console.error("Erro ao atualizar cláusula:", e);
      alert('Erro ao atualizar cláusula.');
    }
  };

  const handleDeleteClause = async (id) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const clauseRef = doc(db, `artifacts/${appId}/users/${userId}/contractClauses`, id);
      await deleteDoc(clauseRef);
      alert('Cláusula eliminada com sucesso!');
    } catch (e) {
      console.error("Erro ao eliminar cláusula:", e);
      alert('Erro ao eliminar cláusula.');
    }
  };

  const handleAddEmailCampaign = async (campaign) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/emailCampaigns`), {
        ...campaign,
        sentAt: serverTimestamp(),
      });
      alert('Campanha de email guardada com sucesso!');
    } catch (e) {
      console.error("Erro ao guardar campanha de email:", e);
      alert('Erro ao guardar campanha de email.');
    }
  };

  const handleAddNewsItem = async (newsItem) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/newsFeedItems`), {
        ...newsItem,
        createdAt: serverTimestamp(),
        createdBy: salesReps.find(rep => rep.id === userId)?.name || 'Utilizador Desconhecido',
      });
      alert('Notícia adicionada com sucesso!');
    } catch (e) {
      console.error("Erro ao adicionar notícia:", e);
      alert('Erro ao adicionar notícia.');
    }
  };

  const handleDeleteNewsItem = async (id) => {
    if (!db || !userId) return;
    if (window.confirm("Tem a certeza que deseja eliminar esta notícia?")) {
      try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const newsItemRef = doc(db, `artifacts/${appId}/users/${userId}/newsFeedItems`, id);
        await deleteDoc(newsItemRef);
        alert('Notícia eliminada com sucesso!');
      } catch (e) {
        console.error("Erro ao eliminar notícia:", e);
        alert('Erro ao eliminar notícia.');
      }
    }
  };

  const handleAddCompanyUpdate = async (contactId, update) => {
    if (!db || !userId) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/sponsorshipContacts/${contactId}/companyUpdates`), {
        ...update,
        createdAt: serverTimestamp(),
        createdBy: salesReps.find(rep => rep.id === userId)?.name || 'Utilizador Desconhecido',
      });
      alert('Atualização da empresa adicionada com sucesso!');
    } catch (e) {
      console.error("Erro ao adicionar atualização da empresa:", e);
      alert('Erro ao adicionar atualização da empresa.');
    }
  };

  const handleAddCounterpart = async (counterpart) => {
    if (!db || !userId) return;
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/counterparts`), {
            ...counterpart,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        alert('Contrapartida adicionada com sucesso!');
    } catch (e) {
        console.error("Erro ao adicionar contrapartida:", e);
        alert('Erro ao adicionar contrapartida.');
    }
  };

  const handleUpdateCounterpart = async (id, updatedFields) => {
      if (!db || !userId) return;
      try {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          const counterpartRef = doc(db, `artifacts/${appId}/users/${userId}/counterparts`, id);
          await updateDoc(counterpartRef, {
              ...updatedFields,
              updatedAt: serverTimestamp()
          });
          alert('Contrapartida atualizada com sucesso!');
      } catch (e) {
          console.error("Erro ao atualizar contrapartida:", e);
          alert('Erro ao atualizar contrapartida.');
      }
  };

  const handleDeleteCounterpart = async (id) => {
      if (!db || !userId) return;
      try {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          const counterpartRef = doc(db, `artifacts/${appId}/users/${userId}/counterparts`, id);
          await deleteDoc(counterpartRef);
          alert('Contrapartida eliminada com sucesso!');
      } catch (e) {
          console.error("Erro ao eliminar contrapartida:", e);
          alert('Erro ao eliminar contrapartida.');
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

  const generateContractForContact = async (contact, selectedClauseIds = []) => { // Renamed selectedClauses to selectedClauseIds for clarity
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
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    const numberToWords = (num) => {
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

    // Insert selected clauses
    let clausesHtml = '';
    if (selectedClauseIds.length > 0) {
        clausesHtml += '<h2>Cláusulas Adicionais:</h2><ul>';
        selectedClauseIds.forEach(clauseId => {
            const clause = contractClauses.find(c => c.id === clauseId);
            if (clause) {
                clausesHtml += `<li><strong>${clause.title}</strong><p>${clause.content}</p></li>`;
            }
        });
        clausesHtml += '</ul>';
    }
    // Ensure the placeholder is correctly replaced
    filledContract = filledContract.replace(/{{CLAUSULAS_ADICIONAIS}}/g, clausesHtml);


    setGeneratedContractContent(filledContract);
    setShowContractModal(true);

    // Prompt for version name and save to Firestore
    const versionName = prompt("Por favor, insira um nome para esta versão do contrato (ex: Proposta V1, Contrato Final):");
    if (versionName) {
      try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/generatedContracts`), {
          contactId: contact.id,
          contactName: contact.name,
          contactCompany: contact.company,
          versionName: versionName,
          content: filledContract,
          generatedAt: serverTimestamp(),
          generatedBy: salesReps.find(rep => rep.name === contact.leadManager)?.name || 'Utilizador Desconhecido' // Assuming leadManager is the generator
        });
        alert('Versão do contrato guardada com sucesso!');
      } catch (e) {
        console.error("Erro ao guardar versão do contrato:", e);
        alert('Erro ao guardar versão do contrato.');
      }
    }
  };


  const filteredContacts = filterPhase === 'Todos'
    ? contacts
    : contacts.filter(contact => contact.negotiationPhase === filterPhase);

  return (
    <div className="flex-grow p-4 bg-white rounded-l-xl md:rounded-l-none md:rounded-tl-xl shadow-2xl md:shadow-none">
      {activeTab === 'inicio' && (
        <MainPage contacts={contacts} activities={activities} leadManagers={salesReps.map(rep => rep.name)} newsFeedItems={newsFeedItems} onAddNewsItem={handleAddNewsItem} onDeleteNewsItem={handleDeleteNewsItem} />
      )}

      {activeTab === 'dashboard' && ( // This is now 'Projetos'
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-700">Os Seus Projetos</h2>
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
              leadManagers={salesReps.map(rep => rep.name)} // Pass sales rep names
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
                  leadManagers={salesReps.map(rep => rep.name)} // Pass sales rep names
                  setEditingContact={setEditingContact}
                  onOpenGenerateContractOptionsModal={() => { // New prop to open modal
                    setContactForContractGeneration(contact);
                    setShowGenerateContractOptionsModal(true);
                  }}
                  onScheduleActivity={() => { setContactForActivity(contact); setShowActivityModal(true); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'contactList' && (
        <ContactListView contacts={contacts} leadManagers={salesReps.map(rep => rep.name)} filterLeadManager={filterLeadManager} setFilterLeadManager={setFilterLeadManager} industryList={industryList} filterIndustry={filterIndustry} setFilterIndustry={setFilterIndustry} />
      )}

      {activeTab === 'clientes' && (
        <Database
          contacts={contacts}
          activities={activities}
          generatedContracts={generatedContracts} // Pass generated contracts
          onUpdateContact={handleUpdateContact}
          onAddActivity={handleAddActivity}
          setEditingContact={setEditingContact}
          editingContact={editingContact}
          showActivityModal={showActivityModal}
          setShowActivityModal={setShowActivityModal}
          contactForActivity={contactForActivity}
          setContactForActivity={setContactForActivity}
          negotiationPhases={negotiationPhases}
          leadManagers={salesReps.map(rep => rep.name)} // Pass sales rep names
          industryList={industryList}
          sponsorshipTiers={sponsorshipTiers} /* Pass sponsorshipTiers */
          onViewGeneratedContract={(contractHtml) => { setGeneratedContractContent(contractHtml); setShowContractModal(true); }}
          onAddCompanyUpdate={handleAddCompanyUpdate} // Pass add company update function
        />
      )}

      {activeTab === 'overview' && (
        <Overview
          contacts={contacts}
          negotiationPhases={negotiationPhases}
          activities={activities}
          onUpdateContact={handleUpdateContact} // Pass onUpdateContact for SalesFunnelBoard
        />
      )}

      {activeTab === 'benefits' && ( /* New BenefitsManagement component */
        <>
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setActiveSponsorshipSubTab('packages')}
              className={`py-2 px-5 rounded-l-lg font-semibold transition-colors duration-200 ${
                activeSponsorshipSubTab === 'packages' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Gestão de Pacotes de Patrocínio
            </button>
            <button
              onClick={() => setActiveSponsorshipSubTab('counterparts')}
              className={`py-2 px-5 rounded-r-lg font-semibold transition-colors duration-200 ${
                activeSponsorshipSubTab === 'counterparts' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Contrapartidas
            </button>
          </div>

          {activeSponsorshipSubTab === 'packages' && (
            <BenefitsManagement
              sponsorshipTiers={sponsorshipTiers}
              onUpdateSponsorshipTiers={handleUpdateSponsorshipTiers}
              contacts={contacts} /* Pass contacts to BenefitsManagement */
              allContacts={contacts} /* Pass all contacts for assignment dropdown */
              onUpdateContact={handleUpdateContact} /* Pass onUpdateContact for assigning tiers */
            />
          )}

          {activeSponsorshipSubTab === 'counterparts' && (
            <CounterpartsManagement
              counterparts={counterparts}
              onAddCounterpart={handleAddCounterpart}
              onUpdateCounterpart={handleUpdateCounterpart}
              onDeleteCounterpart={handleDeleteCounterpart}
            />
          )}
        </>
      )}

      {activeTab === 'contractTemplates' && (
        <ContractManagement
          templateText={contractTemplate}
          onSaveTemplate={handleSaveTemplate}
          contractClauses={contractClauses}
          onAddClause={handleAddClause}
          onUpdateClause={handleUpdateClause}
          onDeleteClause={handleDeleteClause}
        />
      )}

      {activeTab === 'salesTeam' && (
        <SalesRepsManagement
          salesReps={salesReps}
          contacts={contacts}
          activities={activities}
          onAddSalesRep={handleAddSalesRep}
          onUpdateSalesRep={handleUpdateSalesRep}
          onDeleteSalesRep={handleDeleteSalesRep}
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
          contractText={generatedContractContent} // Use generatedContractContent
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

      {showGenerateContractOptionsModal && contactForContractGeneration && (
        <GenerateContractOptionsModal
          contact={contactForContractGeneration}
          contractClauses={contractClauses} // Pass clauses to the modal
          onGenerateContract={generateContractForContact} // Pass the generation function
          onClose={() => {
            setShowGenerateContractOptionsModal(false);
            setContactForContractGeneration(null);
          }}
        />
      )}
    </div>
  );
}


// Main Page Component
function MainPage({ contacts, activities, leadManagers, newsFeedItems, onAddNewsItem, onDeleteNewsItem }) {
  const today = new Date();
  const todayString = today.toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const todayMeetings = activities.filter(activity => {
    if (!activity.activityDateTime) return false;
    const activityDate = new Date(activity.activityDateTime.toDate());
    return activityDate.getDate() === today.getDate() &&
           activityDate.getMonth() === today.getMonth() &&
           activityDate.getFullYear() === today.getFullYear();
  }).sort((a, b) => new Date(a.activityDateTime.toDate()) - new Date(a.activityDateTime.toDate())); // Fixed sorting here

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
      // Removed the direct call to onScheduleActivity as it's not appropriate for an alert display.
      // The user would need to click on something to trigger scheduling.
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

    const today = new Date();

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
      if (contact.negotiationPhase === 'Fechado' && contact.updatedAt) { // Reverted to 'Fechado'
        const closedDate = new Date(contact.updatedAt.toDate());
        const monthKey = `${closedDate.getFullYear()}-${(closedDate.getMonth() + 1).toString().padStart(2, '0')}`;
        if (amountGeneratedByMonth.hasOwnProperty(monthKey)) {
          amountGeneratedByMonth[monthKey] += parseFloat(contact.negotiationValue || 0);
        }
      }
    });

    // Total amount generated for the current season (assuming current year is the season)
    const currentSeasonAmount = managerContacts.reduce((sum, contact) => {
      if (contact.negotiationPhase === 'Fechado' && contact.updatedAt) { // Reverted to 'Fechado'
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
      <h2 className="2xl font-bold text-gray-700 mb-6">Página Principal</h2>

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

      {/* News Feed Section */}
      <NewsFeed newsFeedItems={newsFeedItems} onAddNewsItem={onAddNewsItem} onDeleteNewsItem={onDeleteNewsItem} contacts={contacts} />

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
      case "Prata 🥈": return "bg-gray-400 text-gray-900";    // Silver
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
      const currentClientsInTier = contacts.filter(c => c.sponsorshipTierName === tier.name).length;
      if (selectedTier.limit && currentClientsInTier >= selectedTier.limit) {
        alert(`O pacote ${tier.name} já atingiu o limite de ${selectedTier.limit} clientes.`);
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
function Database({ contacts, activities, generatedContracts, onUpdateContact, onAddActivity, negotiationPhases, leadManagers, setEditingContact, editingContact, showActivityModal, setShowActivityModal, contactForActivity, setContactForActivity, industryList, sponsorshipTiers, onViewGeneratedContract, onAddCompanyUpdate }) { // Added generatedContracts, onViewGeneratedContract, onAddCompanyUpdate
  const { db, userId } = useContext(FirebaseContext); // Destructure db and userId from context
  const [selectedContactId, setSelectedContactId] = useState('');
  const [viewMode, setViewMode] = useState('details'); // 'details' or 'funnel'
  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const clientActivities = selectedContact ? activities.filter(act => act.contactId === selectedContact.id).sort((a, b) => new Date(b.activityDateTime.toDate()) - new Date(a.activityDateTime.toDate())) : [];
  const clientGeneratedContracts = selectedContact ? generatedContracts.filter(contract => contract.contactId === selectedContact.id).sort((a, b) => new Date(b.generatedAt.toDate()) - new Date(a.generatedAt.toDate())) : [];

  const [clientCompanyUpdates, setClientCompanyUpdates] = useState([]); // State for company-specific updates

  // Effect to fetch company updates for the selected contact
  useEffect(() => {
    if (!selectedContact || !selectedContact.id || !db || !userId) { // Add db and userId check
      setClientCompanyUpdates([]);
      return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const companyUpdatesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/sponsorshipContacts/${selectedContact.id}/companyUpdates`);
    const qCompanyUpdates = query(companyUpdatesCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribeCompanyUpdates = onSnapshot(qCompanyUpdates, (snapshot) => {
      const fetchedUpdates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientCompanyUpdates(fetchedUpdates);
    }, (error) => {
      console.error("Erro ao obter atualizações da empresa:", error);
    });

    return () => unsubscribeCompanyUpdates();
  }, [selectedContact, db, userId]); // Add db and userId to dependency array


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

  const handleAddUpdateForClient = (update) => {
    if (selectedContact) {
      onAddCompanyUpdate(selectedContact.id, update);
    }
  };

  // Helper to get tier color for the tag
  const getTierTagColor = (tierName) => {
    switch (tierName) {
      case "Ouro 🥇": return "bg-yellow-400 text-yellow-900"; // Golden
      case "Prata 🥈": return "bg-gray-400 text-gray-900";    // Silver
      case "Bronze 🥉": return "bg-orange-400 text-orange-900"; // Bronze/Copper
      default: return "bg-gray-200 text-gray-700";
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Clientes</h2>

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

      {/* Removed view mode toggle from here as funnel is now in "Processos" */}
      {/* <div className="flex justify-center mb-6">
        <button
          onClick={() => setViewMode('details')}
          className={`py-2 px-5 rounded-l-lg font-semibold transition-colors duration-200 ${
            viewMode === 'details' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Detalhes do Cliente
        </button>
        <button
          onClick={() => setViewMode('funnel')}
          className={`py-2 px-5 rounded-r-lg font-semibold transition-colors duration-200 ${
            viewMode === 'funnel' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Funil de Vendas
        </button>
      </div> */}

      {/* Only show details view here */}
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

          <h4 className="text-xl font-bold text-gray-700 mt-6 mb-4">Histórico de Propostas e Contratos</h4>
          {clientGeneratedContracts.length === 0 ? (
            <p className="text-gray-500 italic">Nenhuma proposta ou contrato gerado para este cliente.</p>
          ) : (
            <ul className="space-y-3">
              {clientGeneratedContracts.map(contract => (
                <li key={contract.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">{contract.versionName}</p>
                    <p className="text-sm text-gray-600">Gerado em: {new Date(contract.generatedAt.toDate()).toLocaleString('pt-PT')}</p>
                    <p className="text-sm text-gray-600">Por: {contract.generatedBy}</p>
                  </div>
                  <button
                    onClick={() => onViewGeneratedContract(contract.content)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out text-sm"
                  >
                    Ver Documento
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* New: Company Updates Section */}
          <h4 className="text-xl font-bold text-gray-700 mt-6 mb-4">Atualizações da Empresa</h4>
          <CompanyUpdateForm onAddUpdate={handleAddUpdateForClient} />
          {clientCompanyUpdates.length === 0 ? (
            <p className="text-gray-500 italic">Nenhuma atualização registada para esta empresa.</p>
          ) : (
            <ul className="space-y-3 mt-4">
              {clientCompanyUpdates.map(update => (
                <li key={update.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
                  <p className="font-semibold text-gray-800">{update.title}</p>
                  <p className="text-sm text-gray-600">{update.description}</p>
                  {update.sourceURL && (
                    <p className="text-sm text-blue-500 hover:underline">
                      <a href={update.sourceURL} target="_blank" rel="noopener noreferrer">Ver Fonte</a>
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Adicionado em: {update.createdAt ? new Date(update.createdAt.toDate()).toLocaleString('pt-PT') : 'N/A'} por {update.createdBy}
                  </p>
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


// Overview Component (Renamed to Processos)
function Overview({ contacts, negotiationPhases, activities, onUpdateContact }) { // Added onUpdateContact
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'calendar'

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Processos</h2>
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setViewMode('map')}
          className={`py-2 px-5 rounded-l-lg font-semibold transition-colors duration-200 ${
            viewMode === 'map' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Mapa de Negociações
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`py-2 px-5 rounded-r-lg font-semibold transition-colors duration-200 ${
            viewMode === 'calendar' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Calendário Semanal
        </button>
        <button
          onClick={() => setViewMode('funnel')}
          className={`py-2 px-5 rounded-r-lg font-semibold transition-colors duration-200 ${
            viewMode === 'funnel' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Funil de Vendas
        </button>
      </div>

      {viewMode === 'map' ? (
        <NegotiationPhaseChart contacts={contacts} negotiationPhases={negotiationPhases} />
      ) : viewMode === 'calendar' ? (
        <WeeklyCalendar contacts={contacts} activities={activities} />
      ) : (
        <SalesFunnelBoard
          contacts={contacts}
          negotiationPhases={negotiationPhases}
          onUpdateContact={onUpdateContact}
        />
      )}
    </div>
  );
}


// Contact Form Component
function ContactForm({ onSubmit, onCancel, initialData = {}, negotiationPhases, leadManagers, industryList = [], sponsorshipTiers = [] }) {
  const [name, setName] = useState(initialData.name || '');
  const [company, setCompany] = useState(initialData.company || '');
  const [email, setEmail] = useState(initialData.email || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [linkedin, setLinkedin] = useState(initialData.linkedin || '');
  const [socialName, setSocialName] = useState(initialData.socialName || '');
  const [nif, setNif] = useState(initialData.nif || '');
  const [taxAddress, setTaxAddress] = useState(initialData.taxAddress || '');
  const [industry, setIndustry] = useState(initialData.industry || industryList[0]);
  const [leadStatus, setLeadStatus] = useState(initialData.leadStatus || 'Cold');
  const [negotiationValue, setNegotiationValue] = useState(initialData.negotiationValue || '');
  const [negotiationPhase, setNegotiationPhase] = useState(initialData.negotiationPhase || negotiationPhases[0]);
  const [leadManager, setLeadManager] = useState(initialData.leadManager || (leadManagers.length > 0 ? leadManagers[0] : ''));
  const [sponsorshipTierName, setSponsorshipTierName] = useState(initialData.sponsorshipTierName || '');
  const [sponsorshipTierBenefits, setSponsorshipTierBenefits] = useState(initialData.sponsorshipTierBenefits || '');
  const [sponsorshipTierValue, setSponsorshipTierValue] = useState(initialData.sponsorshipTierValue || '');
  const [sponsorshipTierDuration, setSponsorshipTierDuration] = useState(initialData.sponsorshipTierDuration || '');
  const [meetingDateTime, setMeetingDateTime] = useState(initialData.meetingDateTime || '');
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

  // Ensure leadManager is set if initialData has one and it's in the list
  useEffect(() => {
    if (initialData.leadManager && leadManagers.includes(initialData.leadManager)) {
      setLeadManager(initialData.leadManager);
    } else if (leadManagers.length > 0 && !initialData.leadManager) {
      setLeadManager(leadManagers[0]); // Set default if no initial data and managers exist
    }
  }, [initialData.leadManager, leadManagers]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !company || !email) {
      alert("Por favor, preencha os campos obrigatórios: Nome, Empresa e Email.");
      return;
    }
    onSubmit({
      name, company, email, phone, linkedin, socialName, nif, taxAddress, industry, leadStatus,
      negotiationValue, negotiationPhase, leadManager, meetingDateTime, notes,
      sponsorshipTierName, sponsorshipTierBenefits, sponsorshipTierValue, sponsorshipTierDuration
    });
  };

  const leadStatusOptions = ["Cold", "Warm", "Hot"];

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8 border border-gray-200 w-full md:max-w-4xl mx-auto">
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
            {["Cold", "Warm", "Hot"].map(status => (
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
          <label htmlFor="meetingDateTime" className="block text-gray-700 text-sm font-bold mb-2">Agendar Nova Ação</label>
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
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
        >
          {initialData.id ? 'Guardar Alterações' : 'Adicionar Contacto'}
        </button>
      </div>
    </form>
  );
}

// Contact Card Component
function ContactCard({ contact, onUpdate, onDelete, onEdit, isEditing, negotiationPhases, leadManagers, setEditingContact, onOpenGenerateContractOptionsModal, onScheduleActivity }) {
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
      <h3 className="text-xl font-bold text-gray-800 mt-8 mb-2">{contact.company}</h3>
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
          onClick={onOpenGenerateContractOptionsModal} // Use the new prop
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

// New Component: GenerateContractOptionsModal
function GenerateContractOptionsModal({ contact, contractClauses, onGenerateContract, onClose }) {
    const [selectedClauses, setSelectedClauses] = useState([]);

    const handleClauseToggle = (clauseId) => {
        setSelectedClauses(prev =>
            prev.includes(clauseId)
                ? prev.filter(id => id !== clauseId)
                : [...prev, clauseId]
        );
    };

    const handleGenerate = () => {
        onGenerateContract(contact, selectedClauses);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-auto">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Gerar Contrato para {contact.company}</h3>
                <p className="text-gray-700 mb-4">Selecione as cláusulas adicionais a incluir no contrato:</p>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 mb-4">
                    {contractClauses.length === 0 ? (
                        <p className="text-gray-500 italic">Nenhuma cláusula disponível na biblioteca.</p>
                    ) : (
                        contractClauses.map(clause => (
                            <div key={clause.id} className="flex items-center mb-2">
                                <input
                                    type="checkbox"
                                    id={`clause-${clause.id}`}
                                    checked={selectedClauses.includes(clause.id)}
                                    onChange={() => handleClauseToggle(clause.id)}
                                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor={`clause-${clause.id}`} className="text-gray-700 text-sm font-semibold">
                                    {clause.title}
                                </label>
                            </div>
                        ))
                    )}
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
                        type="button"
                        onClick={handleGenerate}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                    >
                        Gerar Contrato
                    </button>
                </div>
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
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Contactos</h2>

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
                </th>
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
                        className="p-2 rounded-full bg-[#BFFF00] text-gray-900 shadow-sm hover:bg-green-300 transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.57 6a3 3 0 0 1-3.86 0l-8.57-6Z" />
                          <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 6.868a1.5 1.5 0 0 0 1.972 0l9.714-6.868Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEmailTemplateClick(contact, 'followup')}
                        title="Enviar Follow-up"
                        className="p-2 rounded-full bg-[#BFFF00] text-gray-900 shadow-sm hover:bg-green-300 transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm.53 5.47a.75.75 0 0 0-1.06 0L8.22 10.53a.75.75 0 0 0 0 1.06l3.25 3.25a.75.75 0 0 0 1.06-1.06l-1.97-1.97h6.69a.75.75 0 0 0 0-1.5h-6.69l1.97-1.97a.75.75 0 0 0 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEmailTemplateClick(contact, 'closedeal')}
                        title="Enviar E-mail de Fecho"
                        className="p-2 rounded-full bg-[#BFFF00] text-gray-900 shadow-sm hover:bg-green-300 transition"
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
        <div className="flex flex-col items-center space-y-4">
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
    case "Contacto Inicial": return "text-blue-700 bg-blue-100";
    case "Proposta Enviada": return "text-yellow-700 bg-yellow-100";
    case "Negociação": return "text-purple-700 bg-purple-100";
    case "Fechado": return "text-green-700 bg-green-100";
    case "Perdido": return "text-red-700 bg-red-100";
    default: return "text-gray-700 bg-gray-100";
  }
};

// Weekly Calendar Component
function WeeklyCalendar({ contacts, activities }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => { // Removed extra parentheses here
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
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
        >
          Semana Anterior
        </button>
        <span className="text-lg font-semibold text-gray-800">
          {weekDays[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} - {weekDays[6].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={goToNextWeek}
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
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


// Contract Management Component (formerly ContractTemplates)
function ContractManagement({ templateText, onSaveTemplate, contractClauses, onAddClause, onUpdateClause, onDeleteClause }) {
  const [activeSubTab, setActiveSubTab] = useState('mainTemplate'); // 'mainTemplate' or 'clauseLibrary'

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Gestão de Propostas e Contratos</h2>

      <div className="flex justify-center mb-6">
        <button
          onClick={() => setActiveSubTab('mainTemplate')}
          className={`py-2 px-5 rounded-l-lg font-semibold transition-colors duration-200 ${
            activeSubTab === 'mainTemplate' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Modelo Principal
        </button>
        <button
          onClick={() => setActiveSubTab('clauseLibrary')}
          className={`py-2 px-5 rounded-r-lg font-semibold transition-colors duration-200 ${
            activeSubTab === 'clauseLibrary' ? 'bg-[#BFFF00] text-gray-900 shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Biblioteca de Cláusulas
        </button>
      </div>

      {activeSubTab === 'mainTemplate' && (
        <>
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
            <li><code>{'{{CLAUSULAS_ADICIONAIS}}'}</code>: Conteúdo das cláusulas selecionadas da biblioteca</li>
          </ul>
          <textarea
            className="w-full h-96 p-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            value={templateText}
            onChange={(e) => onSaveTemplate(e.target.value)} // Direct update to parent state
            placeholder="Cole ou escreva o seu modelo de contrato aqui..."
          ></textarea>
          <div className="flex justify-end mt-4">
            <button
              onClick={() => onSaveTemplate(templateText)} // Re-save current text
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
            >
              Guardar Modelo
            </button>
          </div>
        </>
      )}

      {activeSubTab === 'clauseLibrary' && (
        <ClauseLibrary
          contractClauses={contractClauses}
          onAddClause={onAddClause}
          onUpdateClause={onUpdateClause}
          onDeleteClause={onDeleteClause}
        />
      )}
    </div>
  );
}

// New Component: ClauseLibrary
function ClauseLibrary({ contractClauses, onAddClause, onUpdateClause, onDeleteClause }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClause, setEditingClause] = useState(null);

  const ClauseForm = ({ onSubmit, onCancel }) => {
    const [title, setTitle] = useState(editingClause?.title || '');
    const [content, setContent] = useState(editingClause?.content || '');
    const [category, setCategory] = useState(editingClause?.category || 'Geral');

    const categories = ["Geral", "Legal", "Benefícios", "Pagamento", "Outro"];

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!title || !content) {
        alert("Por favor, preencha o título e o conteúdo da cláusula.");
        return;
      }
      onSubmit({ title, content, category });
      onCancel();
    };

    return (
      <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8 border border-gray-200 w-full mx-auto">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">{editingClause ? 'Editar Cláusula' : 'Adicionar Nova Cláusula'}</h3>
        <div className="mb-4">
          <label htmlFor="clauseTitle" className="block text-gray-700 text-sm font-bold mb-2">Título da Cláusula*</label>
          <input
            type="text"
            id="clauseTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="clauseContent" className="block text-gray-700 text-sm font-bold mb-2">Conteúdo da Cláusula*</label>
          <textarea
            id="clauseContent"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="5"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          ></textarea>
        </div>
        <div className="mb-6">
          <label htmlFor="clauseCategory" className="block text-gray-700 text-sm font-bold mb-2">Categoria</label>
          <select
            id="clauseCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
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
            className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
          >
            {editingClause ? 'Guardar Alterações' : 'Adicionar Cláusula'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-700">Cláusulas Padrão</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
        >
          {showAddForm ? 'Cancelar' : 'Adicionar Nova Cláusula'}
        </button>
      </div>

      {showAddForm && (
        <ClauseForm
          onSubmit={onAddClause}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {contractClauses.length === 0 ? (
        <p className="text-center text-gray-500 text-lg py-10">
          Nenhuma cláusula encontrada na biblioteca. Adicione uma para começar!
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contractClauses.map(clause => (
            <div key={clause.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-200 relative">
              <h4 className="text-lg font-bold text-gray-800 mb-2">{clause.title}</h4>
              <p className="text-sm text-gray-600 mb-3 line-clamp-3">{clause.content}</p>
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{clause.category}</span>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setEditingClause(clause)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-lg shadow-md transition duration-300 ease-in-out text-xs"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDeleteClause(clause.id)}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg shadow-md transition duration-300 ease-in-out text-xs"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingClause && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-auto">
            <ClauseForm
              onSubmit={(updatedFields) => {
                onUpdateClause(editingClause.id, updatedFields);
                setEditingClause(null);
              }}
              onCancel={() => setEditingClause(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}


// Contract Display Modal Component
function ContractDisplayModal({ contractText, onClose }) {
  const contentRef = useRef(null); // Create a ref for the content to be printed

  // Function to copy formatted HTML to clipboard for Word/Google Docs
  const copyFormattedHtmlToClipboard = async () => {
    try {
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

      if (navigator.clipboard && navigator.clipboard.writeText) {
        // Modern Clipboard API
        await navigator.clipboard.writeText(tempDiv.outerHTML);
        alert('Conteúdo formatado copiado para a área de transferência! Cole no Google Docs ou Word.');
      } else if (document.execCommand) {
        // Fallback for older browsers (deprecated)
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('copy');
        selection.removeAllRanges();
        alert('Conteúdo formatado copiado para a área de transferência! Cole no Google Docs ou Word.');
      } else {
        alert('O seu navegador não suporta a cópia automática. Por favor, copie o texto manualmente.');
      }
      document.body.removeChild(tempDiv);
      // URL.revokeObjectURL(link.href); // This line was causing an error as 'link' is not defined here.
    } catch (err) {
      console.error('Erro ao copiar para a área de transferência:', err);
      alert('Erro ao copiar para a área de transferência. Por favor, tente novamente ou copie manualmente.');
    }
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
      // Check if html2pdf.js is already loaded
      if (typeof window.html2pdf === 'undefined') {
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
          window.html2pdf().from(contentRef.current).set(opt).save(); // Use window.html2pdf
        };
        script.onerror = () => {
          console.error("Erro ao carregar html2pdf.js");
          alert("Erro ao carregar a biblioteca de PDF. Por favor, tente novamente.");
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
        window.html2pdf().from(contentRef.current).set(opt).save(); // Use window.html2pdf
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

// New Component: CounterpartDeleteConfirmationModal
function CounterpartDeleteConfirmationModal({ counterpartDescription, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full mx-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Confirmar Eliminação</h3>
        <p className="text-gray-700 mb-6">Tem a certeza que deseja eliminar a contrapartida <span className="font-semibold">"{counterpartDescription}"</span>? Esta ação não pode ser desfeita.</p>
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


// New Component: SalesRepsManagement
function SalesRepsManagement({ salesReps, contacts, activities, onAddSalesRep, onUpdateSalesRep, onDeleteSalesRep }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSalesRep, setEditingSalesRep] = useState(null);
  const [selectedSalesRepId, setSelectedSalesRepId] = useState('');
  const selectedSalesRep = salesReps.find(rep => rep.id === selectedSalesRepId);

  // KPI Logic for individual sales rep profile
  const getKpiDataForSalesRep = (salesRepName) => {
    const managerContacts = contacts.filter(c => c.leadManager === salesRepName);
    const managerActivities = activities.filter(a => contacts.find(c => c.id === a.contactId)?.leadManager === salesRepName);

    const today = new Date();

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
      if (contact.negotiationPhase === 'Fechado' && contact.updatedAt) { // Reverted to 'Fechado'
        const closedDate = new Date(contact.updatedAt.toDate());
        const monthKey = `${closedDate.getFullYear()}-${(closedDate.getMonth() + 1).toString().padStart(2, '0')}`;
        if (amountGeneratedByMonth.hasOwnProperty(monthKey)) {
          amountGeneratedByMonth[monthKey] += parseFloat(contact.negotiationValue || 0);
        }
      }
    });

    // Total amount generated for the current season (assuming current year is the season)
    const currentSeasonAmount = managerContacts.reduce((sum, contact) => {
      if (contact.negotiationPhase === 'Fechado' && contact.updatedAt) { // Reverted to 'Fechado'
        const closedDate = new Date(contact.updatedAt.toDate());
        if (closedDate.getFullYear() === today.getFullYear()) { // Simple season definition
          return sum + parseFloat(contact.negotiationValue || 0);
        }
      }
      return sum;
    }, 0);

    return { leadsByDay, contactsByDay, amountGeneratedByMonth, currentSeasonAmount };
  };

  // Helper for generating bar chart SVG (reused from MainPage)
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
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Gestão da Equipa Comercial</h2>

      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-700">Comerciais Registados</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
        >
          {showAddForm ? 'Cancelar' : 'Adicionar Novo Comercial'}
        </button>
      </div>

      {showAddForm && (
        <SalesRepForm
          onSubmit={onAddSalesRep}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="mb-6">
        <label htmlFor="selectSalesRep" className="block text-gray-700 text-sm font-bold mb-2">Selecionar Comercial:</label>
        <select
          id="selectSalesRep"
          value={selectedSalesRepId}
          onChange={(e) => setSelectedSalesRepId(e.target.value)}
          className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        >
          <option value="">-- Selecione um Comercial --</option>
          {salesReps.map(rep => (
            <option key={rep.id} value={rep.id}>{rep.name}</option>
          ))}
        </select>
      </div>

      {selectedSalesRep ? (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Perfil do Comercial: {selectedSalesRep.name}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingSalesRep(selectedSalesRep)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out text-sm"
              >
                Editar Perfil
              </button>
              <button
                onClick={() => onDeleteSalesRep(selectedSalesRep.id)}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out text-sm"
              >
                Eliminar Comercial
              </button>
            </div>
          </div>

          {editingSalesRep && editingSalesRep.id === selectedSalesRep.id && (
            <div className="mb-6">
              <SalesRepForm
                initialData={selectedSalesRep}
                onSubmit={(updatedFields) => {
                  onUpdateSalesRep(selectedSalesRep.id, updatedFields);
                  setEditingSalesRep(null);
                }}
                onCancel={() => setEditingSalesRep(null)}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 mb-6">
            <p><strong>Email:</strong> {selectedSalesRep.email}</p>
            <p><strong>Telefone:</strong> {selectedSalesRep.phone || 'N/A'}</p>
            <p><strong>LinkedIn:</strong> {selectedSalesRep.linkedin ? <a href={selectedSalesRep.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{selectedSalesRep.linkedin}</a> : 'N/A'}</p>
          </div>

          <h4 className="text-xl font-bold text-gray-700 mb-4">Contactos Atribuídos ({contacts.filter(c => c.leadManager === selectedSalesRep.name).length})</h4>
          {contacts.filter(c => c.leadManager === selectedSalesRep.name).length === 0 ? (
            <p className="text-gray-500 italic">Nenhum contacto atribuído a este comercial.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {contacts.filter(c => c.leadManager === selectedSalesRep.name).map(contact => (
                <li key={contact.id}>
                  <span className="font-semibold">{contact.company}</span> - {contact.name} ({contact.negotiationPhase})
                </li>
              ))}
            </ul>
          )}

          <h4 className="text-xl font-bold text-gray-700 mt-6 mb-4">KPIs do Comercial</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderBarChart(
              getKpiDataForSalesRep(selectedSalesRep.name).leadsByDay,
              'Leads Captadas por Dia (Últimos 7 dias)',
              (val) => val,
              (label) => new Date(label).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short'})
            )}
            {renderBarChart(
              getKpiDataForSalesRep(selectedSalesRep.name).contactsByDay,
              'Contactos Feitos por Dia (Últimos 7 dias)',
              (val) => val,
              (label) => new Date(label).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short'})
            )}
            {renderBarChart(
              getKpiDataForSalesRep(selectedSalesRep.name).amountGeneratedByMonth,
              'Montante Gerado em Vendas por Mês (Últimos 6 meses)',
              (val) => val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }),
              (label) => new Date(label + '-01').toLocaleDateString('pt-PT', { month: 'short', year: '2-digit'})
            )}
            <div className="bg-gray-50 p-4 rounded-lg shadow-inner border border-gray-100">
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Total Gerado (Época Atual)</h4>
              <p className="text-2xl font-bold text-green-700">
                {getKpiDataForSalesRep(selectedSalesRep.name).currentSeasonAmount.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-500 text-lg py-10">
          Por favor, selecione um comercial para ver o seu perfil e KPIs.
        </p>
      )}
    </div>
  );
}

// New Component: SalesRepForm
function SalesRepForm({ onSubmit, onCancel, initialData = {} }) {
  const [name, setName] = useState(initialData.name || '');
  const [email, setEmail] = useState(initialData.email || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [linkedin, setLinkedin] = useState(initialData.linkedin || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email) {
      alert("Por favor, preencha o nome e o email do comercial.");
      return;
    }
    onSubmit({ name, email, phone, linkedin });
    if (!initialData.id) { // Only clear form if it's a new entry
      setName('');
      setEmail('');
      setPhone('');
      setLinkedin('');
    }
    onCancel(); // Close form after submission
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8 border border-gray-200 w-full md:max-w-xl mx-auto">
      <h3 className="text-xl font-semibold text-gray-700 mb-4">{initialData.id ? 'Editar Comercial' : 'Registar Novo Comercial'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="repName" className="block text-gray-700 text-sm font-bold mb-2">Nome*</label>
          <input
            type="text"
            id="repName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          />
        </div>
        <div>
          <label htmlFor="repEmail" className="block text-gray-700 text-sm font-bold mb-2">Email*</label>
          <input
            type="email"
            id="repEmail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          />
        </div>
        <div>
          <label htmlFor="repPhone" className="block text-gray-700 text-sm font-bold mb-2">Telefone</label>
          <input
            type="tel"
            id="repPhone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          />
        </div>
        <div>
          <label htmlFor="repLinkedin" className="block text-gray-700 text-sm font-bold mb-2">LinkedIn (URL)</label>
          <input
            type="url"
            id="repLinkedin"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="Ex: https://linkedin.com/in/nome"
          />
        </div>
      </div>
      <div className="flex justify-end gap-4 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
        >
          {initialData.id ? 'Guardar Alterações' : 'Registar Comercial'}
        </button>
      </div>
    </form>
  );
}

// New Component: SalesFunnelBoard
function SalesFunnelBoard({ contacts, negotiationPhases, onUpdateContact }) {
  const handleDragStart = (e, contactId) => {
    e.dataTransfer.setData("contactId", contactId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e, newPhase) => {
    e.preventDefault();
    const contactId = e.dataTransfer.getData("contactId");
    const contact = contacts.find(c => c.id === contactId);

    if (contact && contact.negotiationPhase !== newPhase) {
      onUpdateContact(contactId, { negotiationPhase: newPhase });
    }
  };

  const getPhaseColorForFunnel = (phase) => {
    switch (phase) {
      case "Contacto Inicial": return "bg-blue-50 border-blue-200";
      case "Proposta Enviada": return "bg-yellow-50 border-yellow-200";
      case "Negociação": return "bg-purple-50 border-purple-200";
      case "Fechado": return "bg-green-50 border-green-200";
      case "Perdido": return "bg-red-50 border-red-200";
      default: return "bg-gray-50 border-gray-200";
    }
  };

  const getPhaseTextColor = (phase) => {
    switch (phase) {
      case "Contacto Inicial": return "text-blue-800";
      case "Proposta Enviada": return "text-yellow-800";
      case "Negociação": return "text-purple-800";
      case "Fechado": return "text-green-800";
      case "Perdido": return "text-red-800";
      default: return "text-gray-800";
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-2xl font-bold text-gray-700 mb-6">Funil de Vendas</h3>
      <div className="flex overflow-x-auto space-x-4 pb-4">
        {negotiationPhases.map(phase => (
          <div
            key={phase}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, phase)}
            className={`flex-shrink-0 w-64 p-4 rounded-lg shadow-md border ${getPhaseColorForFunnel(phase)}`}
          >
            <h4 className={`text-lg font-bold mb-4 ${getPhaseTextColor(phase)}`}>
              {phase} ({contacts.filter(c => c.negotiationPhase === phase).length})
            </h4>
            <div className="space-y-3 min-h-[100px]">
              {contacts.filter(c => c.negotiationPhase === phase).map(contact => (
                <div
                  key={contact.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, contact.id)}
                  className="bg-white p-3 rounded-md shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing"
                >
                  <p className="font-semibold text-gray-800">{contact.company}</p>
                  <p className="text-sm text-gray-600">{contact.name}</p>
                  {contact.negotiationValue && (
                    <p className="text-xs text-gray-500 mt-1">
                      {parseFloat(contact.negotiationValue).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// New Component: CampaignManagement
function CampaignManagement({ contacts, emailCampaigns, onAddEmailCampaign, salesReps }) {
  const [campaignObjective, setCampaignObjective] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const [generatingContent, setGeneratingContent] = useState(false);
  const { userId } = useContext(FirebaseContext); // Get userId from context

  const handleGenerateContent = async () => {
    if (!campaignObjective) {
      alert('Por favor, insira o objetivo da campanha.');
      return;
    }
    setGeneratingContent(true);
    try {
      const prompt = `Gera um assunto e um corpo de email para uma campanha de marketing com o seguinte objetivo: "${campaignObjective}". O email deve ser persuasivo e ter uma alta taxa de cliques. Fornece a resposta num formato JSON com as chaves "subject" e "body".`;
      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              "subject": { "type": "STRING" },
              "body": { "type": "STRING" }
            },
            "propertyOrdering": ["subject", "body"]
          }
        }
      };
      const apiKey = ""; // Canvas will provide this
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonResponse = JSON.parse(result.candidates[0].content.parts[0].text);
        setGeneratedSubject(jsonResponse.subject);
        setGeneratedBody(jsonResponse.body);
      } else {
        alert('Não foi possível gerar o conteúdo do email. Tente novamente.');
        console.error('Unexpected AI response structure:', result);
      }
    } catch (error) {
      console.error('Erro ao chamar a API Gemini:', error);
      alert('Erro ao gerar o conteúdo do email. Verifique a sua ligação ou tente novamente.');
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleRecipientToggle = (contactId) => {
    setSelectedRecipientIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSendCampaign = () => {
    if (!generatedSubject || !generatedBody) {
      alert('Por favor, gere o conteúdo do email primeiro.');
      return;
    }
    if (selectedRecipientIds.length === 0) {
      alert('Por favor, selecione pelo menos um destinatário.');
      return;
    }

    const recipientEmails = contacts
      .filter(contact => selectedRecipientIds.includes(contact.id))
      .map(contact => contact.email)
      .join(',');

    const mailtoLink = `mailto:?bcc=${encodeURIComponent(recipientEmails)}&subject=${encodeURIComponent(generatedSubject)}&body=${encodeURIComponent(generatedBody)}`;

    window.open(mailtoLink, '_blank');

    // Save campaign to Firestore
    onAddEmailCampaign({
      objective: campaignObjective,
      subject: generatedSubject,
      body: generatedBody,
      recipientIds: selectedRecipientIds,
      recipientCount: selectedRecipientIds.length,
      sentBy: salesReps.find(rep => rep.id === userId)?.name || 'Utilizador Desconhecido', // Assuming userId is the sender
    });

    // Reset form
    setCampaignObjective('');
    setGeneratedSubject('');
    setGeneratedBody('');
    setSelectedRecipientIds([]);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Gestão de Campanhas de Email</h2>

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
        <h3 className="text-xl font-bold text-gray-700 mb-4">Criar Nova Campanha</h3>
        <div className="mb-4">
          <label htmlFor="campaignObjective" className="block text-gray-700 text-sm font-bold mb-2">Objetivo da Campanha:</label>
          <textarea
            id="campaignObjective"
            value={campaignObjective}
            onChange={(e) => setCampaignObjective(e.target.value)}
            rows="3"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="Ex: Aumentar o reconhecimento da marca para o novo pacote Ouro."
          ></textarea>
        </div>
        <button
          onClick={handleGenerateContent}
          disabled={generatingContent}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingContent ? 'A Gerar...' : 'Gerar Conteúdo com IA'}
        </button>

        {generatedSubject && generatedBody && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-700 mb-2">Conteúdo Sugerido:</h4>
            <p className="font-bold text-gray-800 mb-2">Assunto: {generatedSubject}</p>
            <div className="bg-white p-3 rounded-md border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
              {generatedBody}
            </div>
          </div>
        )}

        <div className="mt-6">
          <h4 className="text-lg font-bold text-gray-700 mb-3">Selecionar Destinatários:</h4>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {contacts.length === 0 ? (
              <p className="text-gray-500 italic">Nenhum contacto disponível para envio.</p>
            ) : (
              contacts.map(contact => (
                <div key={contact.id} className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id={`contact-${contact.id}`}
                    checked={selectedRecipientIds.includes(contact.id)}
                    onChange={() => handleRecipientToggle(contact.id)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`contact-${contact.id}`} className="text-gray-700 text-sm">
                    {contact.name} ({contact.company}) - {contact.email}
                  </label>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSendCampaign}
            disabled={!generatedSubject || !generatedBody || selectedRecipientIds.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar Campanha
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-700 mb-4">Histórico de Campanhas</h3>
        {emailCampaigns.length === 0 ? (
          <p className="text-center text-gray-500 text-lg py-10">
            Nenhuma campanha de email enviada ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {emailCampaigns.map(campaign => (
              <div key={campaign.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
                <p className="font-semibold text-gray-800">Objetivo: {campaign.objective}</p>
                <p className="text-sm text-gray-600">Assunto: {campaign.subject}</p>
                <p className="text-sm text-gray-600 line-clamp-2">Corpo: {campaign.body}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Enviado em: {campaign.sentAt ? new Date(campaign.sentAt.toDate()).toLocaleString('pt-PT') : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">
                  Destinatários: {campaign.recipientCount} contactos
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// New Component: CompanyUpdateForm
function CompanyUpdateForm({ onAddUpdate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceURL, setSourceURL] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !description) {
      alert('Por favor, preencha o título e a descrição da atualização.');
      return;
    }
    onAddUpdate({ title, description, sourceURL });
    setTitle('');
    setDescription('');
    setSourceURL('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-100 p-4 rounded-lg border border-gray-200 mb-6">
      <h4 className="text-lg font-bold text-gray-700 mb-3">Adicionar Nova Atualização da Empresa</h4>
      <div className="mb-3">
        <label htmlFor="updateTitle" className="block text-gray-700 text-sm font-bold mb-1">Título da Atualização*</label>
        <input
          type="text"
          id="updateTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="updateDescription" className="block text-gray-700 text-sm font-bold mb-1">Descrição*</label>
        <textarea
          id="updateDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows="2"
          className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          required
        ></textarea>
      </div>
      <div className="mb-4">
        <label htmlFor="updateSourceURL" className="block text-gray-700 text-sm font-bold mb-1">URL da Fonte (Opcional)</label>
        <input
          type="url"
          id="updateSourceURL"
          value={sourceURL}
          onChange={(e) => setSourceURL(e.target.value)}
          className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          placeholder="Ex: https://noticia.com/titulo"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
        >
          Adicionar Atualização
        </button>
      </div>
    </form>
  );
}

// New Component: NewsFeed
function NewsFeed({ newsFeedItems, onAddNewsItem, onDeleteNewsItem, contacts }) {
  const [showAddNewsForm, setShowAddNewsForm] = useState(false);

  const NewsItemForm = ({ onSubmit, onCancel }) => {
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [url, setUrl] = useState('');
    const [category, setCategory] = useState('Geral');
    const [tags, setTags] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!title || !summary || !url) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
      }
      onSubmit({ title, summary, url, category, tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') });
      setTitle('');
      setSummary('');
      setUrl('');
      setCategory('Geral');
      setTags('');
      onCancel();
    };

    return (
      <form onSubmit={handleSubmit} className="bg-gray-100 p-4 rounded-lg border border-gray-200 mb-6">
        <h4 className="text-lg font-bold text-gray-700 mb-3">Adicionar Nova Notícia</h4>
        <div className="mb-3">
          <label htmlFor="newsTitle" className="block text-gray-700 text-sm font-bold mb-1">Título*</label>
          <input
            type="text"
            id="newsTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="newsSummary" className="block text-gray-700 text-sm font-bold mb-1">Resumo*</label>
          <textarea
            id="newsSummary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows="2"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            required
          ></textarea>
        </div>
        <div className="mb-3">
          <label htmlFor="newsUrl" className="block text-gray-700 text-sm font-bold mb-1">URL*</label>
          <input
            type="url"
            id="newsUrl"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="Ex: https://noticia.com/titulo"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="newsCategory" className="block text-gray-700 text-sm font-bold mb-1">Categoria</label>
          <select
            id="newsCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            <option value="Geral">Geral</option>
            <option value="Sport Algés e Dafundo">Sport Algés e Dafundo</option>
            <option value="Parceiros">Parceiros</option>
            {contacts.map(contact => (
                <option key={contact.id} value={contact.company}>{contact.company}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="newsTags" className="block text-gray-700 text-sm font-bold mb-1">Tags (separadas por vírgula)</label>
          <input
            type="text"
            id="newsTags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="Ex: Importante, Evento, Patrocínio"
          />
        </div>
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
          >
            Adicionar Notícia
          </button>
        </div>
      </form>
    );
  };

  const NewsFeedItem = ({ item, onDelete }) => (
    <div className="flex-shrink-0 w-80 bg-white rounded-lg shadow-md border border-gray-200 p-4 mr-4 relative">
      <button
        onClick={() => onDelete(item.id)}
        className="absolute top-2 right-2 text-gray-400 hover:text-red-600 transition-colors"
        title="Eliminar Notícia"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h4 className="text-md font-bold text-gray-800 mb-2 line-clamp-2">{item.title}</h4>
      <p className="text-sm text-gray-600 mb-2 line-clamp-3">{item.summary}</p>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
          Ler mais
        </a>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {item.category && (
          <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
            {item.category}
          </span>
        )}
        {item.tags && item.tags.map((tag, index) => (
          <span key={index} className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
            {tag}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString('pt-PT') : 'N/A'} por {item.createdBy}
      </p>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-700">Notícias e Atualizações</h3>
        <button
          onClick={() => setShowAddNewsForm(!showAddNewsForm)}
          className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
        >
          {showAddNewsForm ? 'Cancelar' : 'Adicionar Notícia'}
        </button>
      </div>

      {showAddNewsForm && (
        <NewsItemForm onSubmit={onAddNewsItem} onCancel={() => setShowAddNewsForm(false)} />
      )}

      {newsFeedItems.length === 0 ? (
        <p className="text-center text-gray-500 text-lg py-10">
          Nenhuma notícia ou atualização para exibir. Adicione uma!
        </p>
      ) : (
        <div className="flex overflow-x-auto py-4">
          {newsFeedItems.map(item => (
            <NewsFeedItem key={item.id} item={item} onDelete={onDeleteNewsItem} />
          ))}
        </div>
      )}
    </div>
  );
}

// New Component: CounterpartsManagement
function CounterpartsManagement({ counterparts, onAddCounterpart, onUpdateCounterpart, onDeleteCounterpart }) {
    const cycleOptions = ["Diário", "Semanal", "Mensal", "Semestral", "Anual"];
    const [editingId, setEditingId] = useState(null);
    const [newCounterpart, setNewCounterpart] = useState({ description: '', deliveryDeadline: '', cycle: cycleOptions[0] });
    const [showDeleteCounterpartModal, setShowDeleteCounterpartModal] = useState(false);
    const [counterpartToDelete, setCounterpartToDelete] = useState(null);


    const handleEditClick = (counterpart) => {
        setEditingId(counterpart.id);
        setNewCounterpart({ // Populate form for editing
            description: counterpart.description,
            deliveryDeadline: counterpart.deliveryDeadline ? new Date(counterpart.deliveryDeadline.toDate()).toISOString().slice(0, 16) : '', // Convert Timestamp to string for input type="datetime-local"
            cycle: counterpart.cycle
        });
    };

    const handleSaveClick = async (counterpartId) => {
        const counterpartToSave = {
            ...newCounterpart,
            deliveryDeadline: newCounterpart.deliveryDeadline ? new Date(newCounterpart.deliveryDeadline) : '' // Convert string to Date object
        };

        if (counterpartId === 'new') {
            await onAddCounterpart(counterpartToSave);
        } else {
            await onUpdateCounterpart(counterpartId, counterpartToSave);
        }
        setEditingId(null);
        setNewCounterpart({ description: '', deliveryDeadline: '', cycle: cycleOptions[0] });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setNewCounterpart({ description: '', deliveryDeadline: '', cycle: cycleOptions[0] });
    };

    const handleAddClick = () => {
        setEditingId('new'); // Use a special ID for new entry
        setNewCounterpart({ description: '', deliveryDeadline: '', cycle: cycleOptions[0] });
    };

    const confirmDeleteCounterpart = (counterpart) => {
        setCounterpartToDelete(counterpart);
        setShowDeleteCounterpartModal(true);
    };

    const executeDeleteCounterpart = async () => {
        if (counterpartToDelete) {
            await onDeleteCounterpart(counterpartToDelete.id);
            setShowDeleteCounterpartModal(false);
            setCounterpartToDelete(null);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold text-gray-700 mb-6">Gestão de Contrapartidas</h2>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
                <h3 className="text-xl font-bold text-gray-700 mb-4">Lista de Contrapartidas</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etiqueta</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prazo de Entrega</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciclo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {counterparts.map((counterpart, index) => (
                                <tr key={counterpart.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        C{index + 1}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === counterpart.id ? (
                                            <input
                                                type="text"
                                                value={newCounterpart.description}
                                                onChange={(e) => setNewCounterpart({ ...newCounterpart, description: e.target.value })}
                                                className="shadow-sm border rounded-md py-1 px-2 text-gray-700 w-full"
                                            />
                                        ) : (
                                            <span className="text-gray-700">{counterpart.description}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === counterpart.id ? (
                                            <input
                                                type="datetime-local"
                                                value={newCounterpart.deliveryDeadline}
                                                onChange={(e) => setNewCounterpart({ ...newCounterpart, deliveryDeadline: e.target.value })}
                                                className="shadow-sm border rounded-md py-1 px-2 text-gray-700 w-full"
                                            />
                                        ) : (
                                            <span className="text-gray-700">{counterpart.deliveryDeadline ? new Date(counterpart.deliveryDeadline.toDate()).toLocaleString('pt-PT') : 'N/A'}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === counterpart.id ? (
                                            <select
                                                value={newCounterpart.cycle}
                                                onChange={(e) => setNewCounterpart({ ...newCounterpart, cycle: e.target.value })}
                                                className="shadow-sm border rounded-md py-1 px-2 text-gray-700 w-full"
                                            >
                                                {cycleOptions.map(option => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-gray-700">{counterpart.cycle}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {editingId === counterpart.id ? (
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleSaveClick(counterpart.id)}
                                                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-3 rounded-lg shadow-md transition"
                                                >
                                                    Guardar
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-1 px-3 rounded-lg shadow-md transition"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleEditClick(counterpart)}
                                                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-lg shadow-md transition"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => confirmDeleteCounterpart(counterpart)}
                                                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg shadow-md transition"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {editingId === 'new' && (
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        C{counterparts.length + 1}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="text"
                                            value={newCounterpart.description}
                                            onChange={(e) => setNewCounterpart({ ...newCounterpart, description: e.target.value })}
                                            className="shadow-sm border rounded-md py-1 px-2 text-gray-700 w-full"
                                            placeholder="Descrição da contrapartida"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="datetime-local"
                                            value={newCounterpart.deliveryDeadline}
                                            onChange={(e) => setNewCounterpart({ ...newCounterpart, deliveryDeadline: e.target.value })}
                                            className="shadow-sm border rounded-md py-1 px-2 text-gray-700 w-full"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <select
                                            value={newCounterpart.cycle}
                                            onChange={(e) => setNewCounterpart({ ...newCounterpart, cycle: e.target.value })}
                                            className="shadow-sm border rounded-md py-1 px-2 text-gray-700 w-full"
                                        >
                                            {cycleOptions.map(option => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleSaveClick('new')}
                                                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-3 rounded-lg shadow-md transition"
                                            >
                                                Adicionar
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-1 px-3 rounded-lg shadow-md transition"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleAddClick}
                        className="bg-[#BFFF00] text-gray-900 font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:ring-opacity-75"
                    >
                        Criar Nova Contrapartida
                    </button>
                </div>
            </div>

            {showDeleteCounterpartModal && counterpartToDelete && (
                <CounterpartDeleteConfirmationModal
                    counterpartDescription={counterpartToDelete.description}
                    onConfirm={executeDeleteCounterpart}
                    onCancel={() => { setShowDeleteCounterpartModal(false); setCounterpartToDelete(null); }}
                />
            )}
        </div>
    );
}
export default App;
