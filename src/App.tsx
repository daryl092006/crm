import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Campaigns from './components/Campaigns'
import Agents from './components/Agents'
import Settings from './components/Settings'
import ProfileComponent from './components/Profile'
import FollowUps from './components/FollowUps'
import Pipeline from './components/Pipeline'
import Leads from './components/Leads'
import AuditLogs from './components/AuditLogs'
import RequirePermission from './components/RequirePermission'
import { EmailCampaigns } from './components/EmailCampaigns'
import { supabase } from './supabaseClient'
import type { StudentLead, Campaign, Agent, LeadStatus, Profile, Program, ProspectClassification, ProspectSource, MessageTemplate, FollowUpScenario } from './types'
import './index.css'
import { ToastProvider } from './components/Toast'
import OnboardingTour from './components/OnboardingTour'
import { Login } from './components/Login'
import { PopupProvider } from './components/Popup'
import { Menu, X, Target } from 'lucide-react';
import ActivateAccount from './components/ActivateAccount';
import { ResetPassword } from './components/ResetPassword';
import { Routes, Route, useNavigate, Navigate, Outlet, useOutletContext } from 'react-router-dom';

// ─── Types du contexte partagé via Outlet ───────────────────────────────────
export interface AppContextType {
  leads: StudentLead[];
  campaigns: Campaign[];
  agents: Agent[];
  statuses: LeadStatus[];
  programs: Program[];
  classifications: ProspectClassification[];
  sources: ProspectSource[];
  messageTemplates: MessageTemplate[];
  followUpScenarios: FollowUpScenario[];
  profile: Profile | null;
  selectedCampaignId: string;
  setSelectedCampaignId: (id: string) => void;
  statusFilter: string;
  setStatusFilter: (f: string) => void;
  handleUpdateLeads: (newLeads: StudentLead[] | ((prev: StudentLead[]) => StudentLead[])) => void;
  fetchData: () => Promise<void>;
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
}

// Hook pratique pour consommer le contexte dans les pages
export function useAppContext() {
  return useOutletContext<AppContextType>();
}

// ─── Layout protégé (Sidebar + Header mobile + <Outlet />) ──────────────────
function AppLayout({ ctx }: { ctx: AppContextType }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    localStorage.getItem('crm_sidebar_collapsed') === 'true'
  );

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('crm_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <>
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

      {/* OVERLAY MOBILE */}
      <div
        className={`overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <div className="app-container">
        <div 
          className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
          style={{
            width: isSidebarCollapsed ? '80px' : '280px',
            padding: isSidebarCollapsed ? '2.5rem 0.75rem' : '2.5rem 1.5rem',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <Sidebar
            profile={ctx.profile}
            onNavigate={() => setIsSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
          />
        </div>

        <main 
          className="main-content"
          style={{
            marginLeft: isSidebarCollapsed ? '80px' : '280px',
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <Outlet context={ctx} />
        </main>
      </div>
    </>
  );
}

// ─── Composant principal App ─────────────────────────────────────────────────
function App() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const theme = localStorage.getItem('crm_theme');
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setToken(t);
      navigate('/activate');
    }
  }, [navigate]);

  const [leads, setLeads] = useState<StudentLead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [classifications, setClassifications] = useState<ProspectClassification[]>([])
  const [sources, setSources] = useState<ProspectSource[]>([])
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([])
  const [followUpScenarios, setFollowUpScenarios] = useState<FollowUpScenario[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedCampaignId, setSelectedCampaignId] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  useEffect(() => {
    // Safety timeout: stop loading after 6 seconds even if something hangs
    const timeout = setTimeout(() => {
      if (loading) setLoading(false);
    }, 6000);

    // Chargement immédiat des données
    fetchData();

    // --- AUTH STATE LISTENER ---
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: any) => {
      console.log("Auth event:", event);
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password');
      } else if (event === 'SIGNED_OUT') {
        fetchData();
      } else if (event === 'SIGNED_IN') {
        fetchData();
        // Only redirect to dashboard if coming from login page — never interrupt an active session
        const isOnLoginPage = ['/login', '/'].includes(window.location.pathname) && !profile;
        if (isOnLoginPage) navigate('/');
      }
    });

    // --- STABLE FOCUS & VISIBILITY REFRESH ---
    let lastFetchTime = Date.now();

    const handleWindowFocus = () => {
      const now = Date.now();
      if (now - lastFetchTime > 20000) {
        lastFetchTime = now;
        console.log("Window focused/visible, refreshing data...");
        fetchData();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleWindowFocus();
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
      clearTimeout(timeout);
    }
  }, [])


  const fetchData = async () => {
    if (!hasLoadedOnce) {
      setLoading(true);
    }
    console.log("--- Fetching CRM Data (Direct Access) ---");
    try {
      // 1. Get Session
      const { data: { session } } = await (supabase.auth as any).getSession();

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

      // If password change is required, force redirect to profile
      if (profileData.must_change_password) {
        navigate('/profile');
      }

      // 1. Fetch Statuses
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
      const { data: programsData } = await supabase.from('programs').select('*').eq('is_active', true);
      const { data: classificationsData } = await supabase.from('prospect_classifications').select('*').eq('is_active', true).order('sort_order');
      const { data: sourcesData } = await supabase.from('prospect_sources').select('*').eq('is_active', true);
      const { data: templatesData } = await supabase.from('messaging_templates').select('*');
      const { data: scenariosData } = await supabase.from('follow_up_scenarios').select('*');

      if (templatesData) setMessageTemplates(templatesData.map(t => ({
        id: t.id,
        title: t.title,
        content: t.content,
        category: t.category,
        subject: t.subject,
        description: t.description,
        campaign_id: t.campaign_id,
        program_id: t.program_id,
        source_id: t.source_id,
        status_id: t.status_id,
        is_active: t.is_active !== false,
        is_default: t.is_default === true,
        organization_id: t.organization_id,
        metadata: t.metadata,
        created_at: t.created_at
      })));

      if (scenariosData) setFollowUpScenarios(scenariosData.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        trigger_type: s.trigger_type,
        delay_days: s.delay_days,
        channel: s.channel,
        template_id: s.template_id,
        is_active: s.is_active !== false,
        campaign_id: s.campaign_id,
        organization_id: s.organization_id,
        created_by: s.created_by,
        created_at: s.created_at,
        updated_at: s.updated_at
      })));

      if (programsData) setPrograms(programsData.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        level: p.level,
        department: p.department,
        isActive: p.is_active
      })));

      if (classificationsData) setClassifications(classificationsData.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description,
        color: c.color,
        sortOrder: c.sort_order,
        isActive: c.is_active,
        isDefault: c.is_default
      })));

      if (sourcesData) setSources(sourcesData.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        description: s.description,
        isActive: s.is_active
      })));

      // 4. Map Leads & Interactions
      if (leadsData) {
        setLeads((leadsData as any[]).map((l) => ({
          id: l.id,
          organizationId: l.organization_id,
          campaignId: l.campaign_id,
          agentId: l.agent_id,
          statusId: l.status_id,
          firstName: l.first_name,
          lastName: l.last_name,
          email: l.email,
          phone: l.phone,
          whatsapp: l.whatsapp,
          country: l.country,
          city: l.city,
          fieldOfInterest: l.field_of_interest,
          level: l.study_level,
          source: l.source,
          score: l.score || 0,
          notes: l.notes,
          metadata: l.metadata,
          lastInteractionAt: l.last_interaction_at,
          createdAt: l.created_at,
          programId: l.program_id,
          classificationId: l.classification_id,
          sourceId: l.source_id,
          status: (statusesData || []).find(s => s.id === l.status_id),
          interactions: (l.lead_interactions || []).map((i: any) => {
            const interactionType = ({
              'Appel': 'call',
              'WhatsApp': 'whatsapp',
              'SMS': 'sms',
              'Verify': 'note',
              'Confirm': 'note'
            } as Record<string, string>)[i.type] || i.type;
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

      // 5. Harmonize Statuses (STRICT ENFORCEMENT)
      const requiredStatuses = [
        { id: 'nouveau', label: 'Nouveau (Non Contacté)', color: '#6366f1', sort_order: 1 },
        { id: 'interesse', label: 'Intéressé', color: '#8b5cf6', sort_order: 2 },
        { id: 'rappel', label: 'Rappel ou en cours', color: '#f59e0b', sort_order: 3 },
        { id: 'rdv_planifie', label: 'Rendez-vous planifié.', color: '#6366f1', sort_order: 4 },
        { id: 'reflexion', label: 'Réflexion et nous faire un retour', color: '#3b82f6', sort_order: 5 },
        { id: 'dossier_recu', label: 'Dossier reçu', color: '#06b6d4', sort_order: 6 },
        { id: 'admis', label: 'Admis', color: '#a855f7', sort_order: 7 },
        { id: 'inscription_attente', label: 'Inscription en attente', color: '#ec4899', sort_order: 8 },
        { id: 'inscrit', label: 'Inscrit', color: '#22c55e', sort_order: 9 },
        { id: 'reorientation', label: 'Réorientation', color: '#10b981', sort_order: 10 },
        { id: 'pas_interesse', label: 'Pas intéressé', color: '#94a3b8', sort_order: 11 },
        { id: 'refus_categorique', label: 'Refus catégorique', color: '#ef4444', sort_order: 12 },
        { id: 'inscrit_ailleurs', label: 'Inscrit ailleurs', color: '#44403c', sort_order: 13 },
        { id: 'pas_moyens', label: 'Pas les moyens', color: '#44403c', sort_order: 14 },
        { id: 'annee_prochaine', label: "S'inscrire l'année prochaine", color: '#44403c', sort_order: 15 },
        { id: 'pas_disponible', label: 'Pas disponible / contrainte de temps', color: '#44403c', sort_order: 16 },
        { id: 'hors_cible', label: 'Hors cible', color: '#44403c', sort_order: 17 },
        { id: 'refus_repondre', label: 'Refus de répondre', color: '#44403c', sort_order: 18 },
        { id: 'injoignable', label: 'Injoignable/ Ne répond pas', color: '#64748b', sort_order: 19 },
        { id: 'repondeur', label: 'Répondeur', color: '#64748b', sort_order: 20 },
        { id: 'faux_numero', label: 'Faux Numéro', color: '#1c1917', sort_order: 21 },
        { id: 'whatsapp_indisponible', label: 'Numéro non disponible sur WhatsApp.', color: '#94a3b8', sort_order: 22 }
      ];

      const allowedIds = requiredStatuses.map(rs => rs.id);

      if (profileData.role === 'admin') {
        const toDelete = (statusesData || []).filter(s => !allowedIds.includes(s.id));
        if (toDelete.length > 0) {
          console.log("Deleting deprecated statuses:", toDelete.map(s => s.id));
          await supabase.from('lead_statuses').delete().in('id', toDelete.map(s => s.id));

          await supabase.from('leads')
            .update({ status_id: 'nouveau' })
            .not('status_id', 'in', `(${allowedIds.join(',')})`);

          console.log("Database synchronized: legacy statuses migrated to 'nouveau'");
        }

        const existingIds = (statusesData || []).map(s => s.id);
        const toCreate = requiredStatuses.filter(rs => !existingIds.includes(rs.id));

        if (toCreate.length > 0) {
          await supabase.from('lead_statuses').insert(toCreate.map(s => ({
            id: s.id,
            label: s.label,
            color: s.color,
            sort_order: s.sort_order,
            organization_id: '00000000-0000-0000-0000-000000000000'
          })));
        }
      }

      const { data: finalStatuses } = await supabase.from('lead_statuses').select('*').order('sort_order');
      if (finalStatuses) {
        setStatuses(finalStatuses
          .filter(s => allowedIds.includes(s.id))
          .map(s => ({
            id: s.id,
            label: s.label,
            color: s.color,
            isDefault: s.is_default,
            sortOrder: s.sort_order
          }))
        );
      }

      if (campaignsData) setCampaigns((campaignsData as any[]).map((c) => ({
        id: c.id,
        organizationId: c.organization_id,
        name: c.name,
        description: c.description,
        source: c.source,
        budget: c.budget,
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status || 'draft',
        isActive: c.status === 'active',
        column_mappings: c.column_mappings,
        archivedAt: c.archived_at,
        objective: c.objective,
        metadata: c.metadata
      })));

      if (agentsData) setAgents((agentsData as any[]).filter((a) => a.id !== '00000000-0000-0000-0000-000000000000' && ['agent', 'superagent'].includes(a.role)).map((a): Agent => {
        const agentLeads = (leadsData || []).filter((l) => (l as any).agent_id === a.id);
        const assignedCount = agentLeads.length;

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
          capacityWeight: a.capacity_weight || 1,
          leadsAssigned: assignedCount,
          overdueTasksCount: 0,
          conversionRate: rate,
          avgResponseTime: Number(avgResponseTimeHours.toFixed(1)),
          isActive: a.is_active !== false,
          mustChangePassword: a.must_change_password || false
        };
      }))

      console.log("Fetch success: Leads:", leadsData?.length, "Campaigns:", campaignsData?.length, "Agents:", agentsData?.length);
      setHasLoadedOnce(true);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateLeads = (newLeads: StudentLead[] | ((prev: StudentLead[]) => StudentLead[])) => {
    setLeads(newLeads);
  }

  // Loader plein écran uniquement au premier chargement
  if (loading && !hasLoadedOnce && leads.length === 0) {
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

  // Contexte partagé passé à toutes les routes via Outlet
  const ctx: AppContextType = {
    leads,
    campaigns,
    agents,
    statuses,
    programs,
    classifications,
    sources,
    messageTemplates,
    followUpScenarios,
    profile,
    selectedCampaignId,
    setSelectedCampaignId,
    statusFilter,
    setStatusFilter,
    handleUpdateLeads,
    fetchData,
    setCampaigns,
  };

  return (
    <ToastProvider>
      <PopupProvider>
        <Routes>
          {/* ── Routes publiques ── */}
          <Route path="/reset-password" element={<ResetPassword onComplete={() => navigate('/login')} />} />
          <Route path="/activate" element={<ActivateAccount />} />
          <Route path="/login" element={!profile ? <Login /> : <Navigate to="/" />} />

          {/* ── Routes protégées avec layout ── */}
          <Route
            path="/"
            element={!profile ? <Navigate to="/login" /> : <AppLayout ctx={ctx} />}
          >
            <Route index element={
              <Dashboard
                leads={leads}
                campaigns={campaigns}
                statuses={statuses}
                setActiveTab={(tab) => {
                  // Compatibilité : Dashboard utilise encore setActiveTab pour naviguer
                  const routes: Record<string, string> = {
                    leads: '/leads', pipeline: '/pipeline', campaigns: '/campaigns',
                    followups: '/followups', agents: '/agents', settings: '/settings',
                    profile: '/profile', auditlogs: '/audit-logs', email_campaigns: '/email-campaigns'
                  };
                  navigate(routes[tab] || '/');
                }}
                setStatusFilter={setStatusFilter}
                selectedCampaignId={selectedCampaignId}
                setSelectedCampaignId={setSelectedCampaignId}
                profile={profile}
              />
            } />
            <Route path="leads" element={
              <Leads
                leads={leads}
                statuses={statuses}
                campaigns={campaigns}
                agents={agents}
                onRefresh={fetchData}
                profile={profile}
                initialStatusFilter={statusFilter}
                onFilterChange={setStatusFilter}
                initialCampaignFilter={selectedCampaignId}
                onCampaignChange={setSelectedCampaignId}
                programs={programs}
                classifications={classifications}
                sources={sources}
                messageTemplates={messageTemplates}
              />
            } />
            <Route path="pipeline" element={
              <Pipeline
                profile={profile}
                leads={leads}
                setLeads={handleUpdateLeads}
                campaigns={campaigns}
                agents={agents}
                statuses={statuses}
                programs={programs}
                classifications={classifications}
                sources={sources}
              />
            } />
            <Route path="campaigns" element={
              <RequirePermission role={profile?.role} allowedRoles={['admin', 'superagent']}>
                <Campaigns
                  profile={profile}
                  campaigns={campaigns}
                  setCampaigns={setCampaigns}
                  leads={leads}
                  setLeads={handleUpdateLeads}
                  agents={agents}
                  onRefresh={fetchData}
                />
              </RequirePermission>
            } />
            <Route path="email-campaigns" element={
              <RequirePermission role={profile?.role} allowedRoles={['admin', 'superagent', 'direction', 'superviseur']}>
                <EmailCampaigns profile={profile} />
              </RequirePermission>
            } />
            <Route path="followups" element={
              <FollowUps
                profile={profile}
                agents={agents}
                leads={leads}
                onRefresh={fetchData}
              />
            } />
            <Route path="agents" element={
              <RequirePermission role={profile?.role} allowedRoles={['admin', 'superagent']}>
                <Agents
                  profile={profile}
                  agents={agents}
                  leads={leads}
                  setLeads={handleUpdateLeads}
                  campaigns={campaigns}
                  statuses={statuses}
                  onRefresh={fetchData}
                />
              </RequirePermission>
            } />
            <Route path="audit-logs" element={
              <RequirePermission role={profile?.role} allowedRoles={['admin', 'superagent', 'direction', 'superviseur']}>
                <AuditLogs profile={profile} agents={agents} />
              </RequirePermission>
            } />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={
              <ProfileComponent
                profile={profile}
                leads={leads}
                statuses={statuses}
                onUpdate={fetchData}
              />
            } />
            {/* Fallback → Dashboard */}
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      </PopupProvider>
    </ToastProvider>
  );
}

export default App
