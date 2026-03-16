import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Campaigns from './components/Campaigns'
import Agents from './components/Agents'
import Settings from './components/Settings'
import Profile from './components/Profile'
import { supabase } from './supabaseClient'
import type { StudentLead, Campaign, Agent, LeadStatus } from './types'
import './index.css'
import { ToastProvider } from './components/Toast'
import OnboardingTour from './components/OnboardingTour'
import { PopupProvider } from './components/Popup'

function App() {
  // --- BYPASS AUTH MODE ---
  const [activeTab, setActiveTab] = useState(localStorage.getItem('crm_active_tab') || 'dashboard')

  useEffect(() => {
    localStorage.setItem('crm_active_tab', activeTab);
  }, [activeTab]);
  const [leads, setLeads] = useState<StudentLead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    // Safety timeout: stop loading after 6 seconds even if something hangs
    const timeout = setTimeout(() => {
      if (loading) setLoading(false);
    }, 6000);

    // Chargement immédiat des données
    fetchData();

    // --- REALTIME SUBSCRIPTION ---
    // Listen for changes in the database and refresh data automatically
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_statuses' },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timeout);
    }
  }, [])


  const fetchData = async () => {
    setLoading(true)
    console.log("--- Fetching CRM Data (Direct Access) ---");
    try {
      // Configuration forcée du profil (Plus besoin de session !)
      const mockProfile = {
        id: '00000000-0000-0000-0000-000000000000',
        organization_id: '00000000-0000-0000-0000-000000000000',
        full_name: 'Direction / Système',
        role: 'admin' as 'admin',
        email: 'admin@elitecrm.dev'
      };
      setProfile(mockProfile);

      // 1. Fetch Statuses
      const { data: statusesData } = await supabase.from('lead_statuses').select('*').order('sort_order');
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
          score: l.score || 0,
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

      // 5. Harmonize Statuses (STRICT ENFORCEMENT)
      const requiredStatuses = [
        { id: 'nouveau', label: 'Nouveau/ Nouveau fichier', color: '#6366f1', sort_order: 1 },
        { id: 'interesse', label: 'Intéressé', color: '#8b5cf6', sort_order: 2 },
        { id: 'rappel', label: 'Rappel ou en cours', color: '#f59e0b', sort_order: 3 },
        { id: 'rdv_planifie', label: 'Rendez-vous planifié.', color: '#6366f1', sort_order: 4 },
        { id: 'reflexion', label: 'Réflexion et nous faire un retour', color: '#3b82f6', sort_order: 5 },
        { id: 'dossier_recu', label: 'Dossiers reçus', color: '#06b6d4', sort_order: 6 },
        { id: 'admis', label: 'Admis', color: '#a855f7', sort_order: 7 },
        { id: 'inscription_attente', label: 'Inscription en attente', color: '#ec4899', sort_order: 8 },
        { id: 'inscrit', label: 'Inscrit', color: '#22c55e', sort_order: 9 },
        { id: 'reorientation', label: 'Réorientation', color: '#10b981', sort_order: 10 },
        { id: 'pas_interesse', label: 'Pas intéressé', color: '#94a3b8', sort_order: 11 },
        { id: 'refus_categorique', label: 'Refus catégorique', color: '#ef4444', sort_order: 12 },
        { id: 'inscrit_ailleurs', label: 'Déjà inscrit ailleurs', color: '#44403c', sort_order: 13 },
        { id: 'pas_moyens', label: 'Pas les moyens', color: '#44403c', sort_order: 14 },
        { id: 'annee_prochaine', label: 'S’inscrire l’année prochaine', color: '#44403c', sort_order: 15 },
        { id: 'pas_disponible', label: 'Pas disponible / contrainte de temps', color: '#44403c', sort_order: 16 },
        { id: 'hors_cible', label: 'Hors-cible', color: '#44403c', sort_order: 17 },
        { id: 'refus_repondre', label: 'Refus de répondre', color: '#44403c', sort_order: 18 },
        { id: 'injoignable', label: 'Injoignable / ne répond pas', color: '#64748b', sort_order: 19 },
        { id: 'repondeur', label: 'Répondeur', color: '#64748b', sort_order: 20 },
        { id: 'faux_numero', label: 'Numéro incorrect / faux numéro', color: '#1c1917', sort_order: 21 }
      ];

      const allowedIds = requiredStatuses.map(rs => rs.id);
      
      // Delete any status in DB that is NOT in our required list
      const toDelete = (statusesData || []).filter(s => !allowedIds.includes(s.id));
      if (toDelete.length > 0) {
        console.log("Deleting deprecated statuses:", toDelete.map(s => s.id));
        await supabase.from('lead_statuses').delete().in('id', toDelete.map(s => s.id));
        
        // ROADMAP REPAIR: Move all leads with "illegal" statuses back to 'nouveau'
        // This fixes why the user was still seeing old labels
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

      // Always re-fetch to ensure perfect sync
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

      if (campaignsData) setCampaigns(campaignsData.map((c: any) => ({
        id: c.id,
        organizationId: c.organization_id,
        name: c.name,
        source: c.source,
        budget: c.budget, // Correction de l'ancienne erreur (c.budget instead of c.budget)
        startDate: c.start_date,
        endDate: c.end_date,
        isActive: c.is_active,
        column_mappings: c.column_mappings
      })));

      if (agentsData) setAgents(agentsData.filter((a: any) => a.id !== '00000000-0000-0000-0000-000000000000').map(a => {
        const agentLeads = (leadsData || []).filter((l: any) => l.agent_id === a.id);
        const assignedCount = agentLeads.length;

        // CALCUL HARMONISÉ (Identique au AgentStatsModal)
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
          // Filter for real contact interactions, not just notes if possible, but let's take any first interaction for now
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
          avgResponseTime: Number(avgResponseTimeHours.toFixed(1))
        };
      }))

      console.log("Fetch success: Leads:", leadsData?.length, "Campaigns:", campaignsData?.length, "Agents:", agentsData?.length);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false)
    }
  }


  const handleUpdateLeads = async (newLeads: StudentLead[] | ((prev: StudentLead[]) => StudentLead[])) => {
    if (typeof newLeads === 'function') setLeads(newLeads(leads));
    else setLeads(newLeads);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader-container">
          <div className="loader-rings"></div>
          <div className="loader-rings"></div>
          <div className="loader-rings"></div>
        </div>
        <div className="loading-text">Elite CRM</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <PopupProvider>
        <OnboardingTour />
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="main-content">
          {activeTab === 'dashboard' && <Dashboard leads={leads} campaigns={campaigns} statuses={statuses} />}
          {activeTab === 'campaigns' && <Campaigns profile={profile} campaigns={campaigns} setCampaigns={setCampaigns} leads={leads} setLeads={handleUpdateLeads as any} agents={agents} onRefresh={fetchData} />}
          {activeTab === 'agents' && <Agents profile={profile} agents={agents} leads={leads} setLeads={handleUpdateLeads as any} campaigns={campaigns} statuses={statuses} onRefresh={fetchData} />}


          {activeTab === 'settings' && <Settings />}
          {activeTab === 'profile' && <Profile profile={profile} leads={leads} statuses={statuses} onUpdate={fetchData} />}

        </main>
      </PopupProvider>
    </ToastProvider>
  );
}

export default App
