import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Campaigns from './components/Campaigns'
import Agents from './components/Agents'
import Settings from './components/Settings'
import ProfileComponent from './components/Profile'
import Pipeline from './components/Pipeline'
import Leads from './components/Leads'
import { supabase } from './supabaseClient'
import type { StudentLead, Campaign, Agent, LeadStatus, Profile } from './types'
import './index.css'
import { ToastProvider } from './components/Toast'
import OnboardingTour from './components/OnboardingTour'
import { Login } from './components/Login'
import { PopupProvider } from './components/Popup'
import { Menu, X, Target } from 'lucide-react';
import ActivateAccount from './components/ActivateAccount';

function App() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) setToken(t);
  }, []);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('crm_active_tab') || 'dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // New state for sidebar visibility

  useEffect(() => {
    localStorage.setItem('crm_active_tab', activeTab);
  }, [activeTab]);

  // New useEffect to close sidebar on mobile when activeTab changes
  useEffect(() => {
    if (window.innerWidth < 768) { // Assuming 768px is the breakpoint for mobile
      setIsSidebarOpen(false);
    }
  }, [activeTab]);

  const [leads, setLeads] = useState<StudentLead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCampaignId, setSelectedCampaignId] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')


  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    // Safety timeout: stop loading after 6 seconds even if something hangs
    const timeout = setTimeout(() => {
      if (loading) setLoading(false);
    }, 6000);

    // Chargement immédiat des données
    fetchData();

    // --- AUTH STATE LISTENER ---
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log("Auth event in App:", event);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovering(true);
      }
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) {
        fetchData();
      }
    });

    // --- REALTIME SUBSCRIPTION ---
    // Listen for changes in the database and refresh data automatically
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => fetchData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        () => fetchData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_statuses' },
        () => fetchData(true)
      )
      .subscribe()

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      clearTimeout(timeout);
    }
  }, [])


  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    console.log(`--- Fetching CRM Data (${silent ? 'Silent' : 'Full'}) ---`);
    try {
      // 1. Get Session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // 2. Fetch Profile from DB based on auth ID
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profileData) {
        console.error("Profile fetch error:", profileError);
        // If no profile but auth exists, we might need to sign out or show error
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile({
        id: profileData.id,
        organization_id: profileData.organization_id,
        full_name: profileData.full_name,
        role: profileData.role,
        email: profileData.email,
        created_at: profileData.created_at,
        must_change_password: profileData.must_change_password
      });

      // If password change is required, force redirect to profile tab
      if (profileData.must_change_password) {
        setActiveTab('profile');
      }

      // 1. Fetch Statuses (renumbered internal steps)
      const { data: statusesData } = await supabase.from('lead_statuses').select('*').order('label');
      if (statusesData) {
        setStatuses(statusesData.map(s => ({
          id: s.id,
          label: s.label,
          color: s.color,
          isDefault: s.is_default,
          sortOrder: s.sort_order
        })));
      }

      // 3. Fetch Data with Relations
      const { data: leadsData } = await supabase.from('leads').select('*, lead_interactions(*)').order('created_at', { ascending: false });
      const { data: campaignsData } = await supabase.from('campaigns').select('*');
      const { data: agentsData } = await supabase.from('profiles').select('*');

      // 4. Map Leads & Interactions
      if (leadsData) {
        setLeads(leadsData.map((l: any) => ({
          ...l, // On garde toutes les colonnes personnalisées (Hondorateur, Profession, etc.)
          id: l.id,
          organizationId: l.organization_id,
          campaignId: l.campaign_id,
          agentId: l.agent_id,
          statusId: l.status_id,
          firstName: l.first_name,
          lastName: l.last_name,
          email: l.email,
          phone: l.phone,
          country: l.country,
          city: l.city,
          fieldOfInterest: l.field_of_interest,
          level: l.study_level,
          notes: l.notes,
          metadata: l.metadata,
          lastInteractionAt: l.last_interaction_at,
          createdAt: l.created_at,
          status: (statusesData || []).find(s => s.id === l.status_id),
          interactions: (l.lead_interactions || []).map((i: any) => {
            const interactionType = ({
              'Appel': 'call',
              'WhatsApp': 'whatsapp',
              'SMS': 'sms',
              'Verify': 'note',
              'Confirm': 'note'
            } as any)[i.type] || i.type; // Fallback to original type if not found
            return {
              id: i.id,
              leadId: i.lead_id,
              agentId: i.agent_id,
              type: interactionType,
              content: i.content,
              createdAt: i.created_at
            };
          })
        })));
      }

      // 5. Map Campaigns
      if (campaignsData) {
        setCampaigns(campaignsData.map((c: any) => ({
          id: c.id,
          organizationId: c.organization_id,
          name: c.name,
          source: c.source,
          column_mappings: c.column_mappings,
          startDate: c.start_date,
          endDate: c.end_date,
          isActive: c.is_active ?? true, // Ajout de la propriété manquante
          status: c.status
        })));
      }

      // 6. Map Agents
      if (agentsData) {
        setAgents(agentsData.filter((a: any) => 
          a.id !== '00000000-0000-0000-0000-000000000000' && 
          a.role !== 'super_admin' && 
          a.role !== 'admin' &&
          a.role !== 'observer'
        ).map((a: any): Agent => {
          const agentLeads = (leadsData || []).filter((l: any) => l.agent_id === a.id);
          const assignedCount = agentLeads.length;

          // CALCUL HARMONISÉ
          const contactedCount = agentLeads.filter(l => {
            const sid = (l.status_id || '').toLowerCase();
            return sid !== 'nouveau' && sid !== '';
          }).length;

          const pasReponduCount = agentLeads.filter(l => {
            const sid = (l.status_id || '').toLowerCase();
            return sid === 'injoignable' || sid === 'repondeur';
          }).length;

          const reachedCount = contactedCount - pasReponduCount;

          const inscribedCount = agentLeads.filter((l: any) =>
            ['admis', 'inscription_attente', 'inscrit'].some(k => (l.status_id || '').toLowerCase().includes(k))
          ).length;

          const rate = reachedCount > 0 ? Math.round((inscribedCount / reachedCount) * 100) : 0;

          const responseTimes = agentLeads.map((l: any) => {
            if (!l.lead_interactions || l.lead_interactions.length === 0) return null;
            const interactions = l.lead_interactions.filter((i: any) => ['call', 'whatsapp', 'sms'].includes(i.type));
            if (interactions.length === 0) return null;

            const firstInteraction = interactions.reduce((prev: any, curr: any) => {
              return new Date(curr.created_at) < new Date(prev.created_at) ? curr : prev;
            });

            const diffMs = new Date(firstInteraction.created_at).getTime() - new Date(l.created_at).getTime();
            return diffMs > 0 ? diffMs : null;
          });
          const validTimes = responseTimes.filter((t): t is number => t !== null);

          const avgResponseTimeHours = validTimes.length > 0
            ? (validTimes.reduce((a, b) => a + b, 0) / validTimes.length) / (1000 * 60 * 60)
            : 0;

          return {
            id: a.id,
            organizationId: a.organization_id,
            name: a.full_name || a.email?.split('@')[0] || 'Agent',
            email: a.email || '',
            role: a.role,
            avatarUrl: a.avatar_url,
            leadsAssigned: assignedCount,
            overdueTasksCount: 0, // Initialisé à 0
            conversionRate: rate,
            avgResponseTime: Number(avgResponseTimeHours.toFixed(1)),
            isActive: a.is_active !== false,
            capacityWeight: a.capacity_weight || 1,
            capacity_weight: a.capacity_weight || 1,
            mustChangePassword: a.must_change_password || false
          };
        }));
      }

    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- HARMONIZATION EFFECT ---
  // Runs once on startup for admins to cleanup legacy data
  useEffect(() => {
    const harmonize = async () => {
        if (!profile || profile.role !== 'super_admin') return;
        
        const requiredStatuses = [
            { id: 'nouveau' }, { id: 'interesse' }, { id: 'rappel' }, { id: 'rdv_planifie' }, 
            { id: 'reflexion' }, { id: 'dossier_recu' }, { id: 'admis' }, { id: 'inscription_attente' }, 
            { id: 'inscrit' }, { id: 'reorientation' }, { id: 'pas_interesse' }, { id: 'refus_categorique' }, 
            { id: 'inscrit_ailleurs' }, { id: 'pas_moyens' }, { id: 'annee_prochaine' }, 
            { id: 'pas_disponible' }, { id: 'hors_cible' }, { id: 'refus_repondre' }, 
            { id: 'injoignable' }, { id: 'repondeur' }, { id: 'faux_numero' }, { id: 'whatsapp_indisponible' }
        ];
        
        const allowedIds = requiredStatuses.map(rs => rs.id);
        const { data: currentStatuses } = await supabase.from('lead_statuses').select('id');
        const toDelete = (currentStatuses || []).filter(s => !allowedIds.includes(s.id));
        
        if (toDelete.length > 0) {
            await supabase.from('lead_statuses').delete().in('id', toDelete.map(s => s.id));
            await supabase.from('leads').update({ status_id: 'nouveau' }).not('status_id', 'in', `(${allowedIds.join(',')})`);
            console.log("Database Harmonized.");
            fetchData(true);
        }
    };
    harmonize();
  }, [profile?.id]);

  const handleUpdateLeads = async (newLeads: StudentLead[] | ((prev: StudentLead[]) => StudentLead[])) => {
    if (typeof newLeads === 'function') setLeads(newLeads(leads));
    else setLeads(newLeads);
  };

  if (token) {
    return (
      <ToastProvider>
        <ActivateAccount />
      </ToastProvider>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader-container">
          <div className="loader-rings"></div>
          <div className="loader-rings"></div>
          <div className="loader-rings"></div>
        </div>
        <div className="loading-text">ESCEN CRM</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <PopupProvider>
        <OnboardingTour />

        {/* MOBILE HEADER */}
        <div className="mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Target size={18} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>ESCEN CRM</h2>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* OVERLAY FOR MOBILE */}
        <div
          className={`overlay ${isSidebarOpen ? 'show' : ''}`}
          onClick={() => setIsSidebarOpen(false)}
        />

        <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setIsSidebarOpen(false);
            }}
            profile={profile}
          />
        </div>

        <main className="main-content">
          {!isRecovering && activeTab === 'dashboard' && (
            <Dashboard
              leads={leads}
              campaigns={campaigns}
              statuses={statuses}
              setActiveTab={setActiveTab}
              setStatusFilter={setStatusFilter}
              selectedCampaignId={selectedCampaignId}
              setSelectedCampaignId={setSelectedCampaignId}
              profile={profile}
            />
          )}
          {!isRecovering && activeTab === 'pipeline' && (
            <Pipeline
              profile={profile}
              leads={leads}
              setLeads={handleUpdateLeads as any}
              campaigns={campaigns}
              agents={agents}
              statuses={statuses}
            />
          )}
          {!isRecovering && activeTab === 'leads' && (
            <Leads
              leads={leads}
              statuses={statuses}
              campaigns={campaigns}
              onRefresh={fetchData}
              profile={profile}
            />
          )}
          {!isRecovering && activeTab === 'campaigns' && <Campaigns profile={profile} campaigns={campaigns} setCampaigns={setCampaigns} leads={leads} setLeads={handleUpdateLeads as any} agents={agents} onRefresh={fetchData} />}
          {!isRecovering && activeTab === 'agents' && <Agents profile={profile} agents={agents} leads={leads} setLeads={handleUpdateLeads as any} campaigns={campaigns} statuses={statuses} onRefresh={fetchData} />}


          {!isRecovering && activeTab === 'settings' && <Settings />}
          {!isRecovering && activeTab === 'profile' && <ProfileComponent profile={profile} leads={leads} statuses={statuses} onUpdate={fetchData} />}

          {(!profile || isRecovering) && <Login />}

        </main>
      </PopupProvider>
    </ToastProvider>
  );
}

export default App
