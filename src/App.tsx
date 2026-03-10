import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Campaigns from './components/Campaigns'
import Agents from './components/Agents'
import Messaging from './components/Messaging'
import { Login } from './components/Login'
import { supabase } from './supabaseClient'
import type { StudentLead, Campaign, Agent } from './types'
import './index.css'
import type { Session } from '@supabase/supabase-js'
import { ToastProvider } from './components/Toast'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [leads, setLeads] = useState<StudentLead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [role, setRole] = useState<'admin' | 'agent'>('agent')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchData()
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchData()
      else {
        setLeads([])
        setCampaigns([])
        setAgents([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session?.user.id).single();
      if (profile) setRole(profile.role)

      const { data: leadsData } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
      const { data: campaignsData } = await supabase.from('campaigns').select('*')
      const { data: agentsData } = await supabase.from('profiles').select('*')

      if (leadsData) {
        setLeads(leadsData.map((l: any) => ({
          id: l.id,
          firstName: l.first_name,
          lastName: l.last_name,
          email: l.email,
          phone: l.phone,
          country: l.country,
          city: l.city,
          fieldOfInterest: l.field_of_interest,
          level: l.level,
          source: l.source,
          status: l.status,
          campaignId: l.campaign_id,
          agentId: l.agent_id,
          phoneVerification: l.phone_verification,
          notes: l.notes,
          interactions: l.interactions || [],
          createdAt: l.created_at
        })));
      }
      if (campaignsData) setCampaigns(campaignsData.map((c: any) => ({
        id: c.id,
        name: c.name,
        startDate: c.start_date,
        endDate: c.end_date,
        budget: c.budget,
        type: c.type
      })));
      if (agentsData) setAgents(agentsData.map(a => {
        const agentLeads = (leadsData || []).filter((l: any) => l.agent_id === a.id);
        const assignedCount = agentLeads.length;
        const inscribedCount = agentLeads.filter((l: any) => l.status === 'Inscrit').length;
        const rate = assignedCount > 0 ? Math.round((inscribedCount / assignedCount) * 100) : 0;

        return {
          id: a.id,
          name: a.full_name || a.email.split('@')[0],
          email: a.email,
          leadsAssigned: assignedCount,
          overdueTasksCount: a.overdue_tasks_count || 0,
          capacityWeight: a.capacity_weight || 1,
          conversionRate: rate
        };
      }) as any)
    } finally {
      setLoading(false)
    }
  }

  const mapLeadToDb = (l: StudentLead, organizationId: string | undefined) => ({
    id: l.id,
    first_name: l.firstName,
    last_name: l.lastName,
    email: l.email,
    phone: l.phone,
    country: l.country,
    city: l.city,
    field_of_interest: l.fieldOfInterest,
    level: l.level,
    source: l.source,
    status: l.status,
    campaign_id: l.campaignId,
    agent_id: l.agentId,
    phone_verification: l.phoneVerification,
    notes: l.notes,
    interactions: l.interactions,
    created_at: l.createdAt,
    organization_id: organizationId
  });

  const handleUpdateLeads = async (newLeads: StudentLead[] | ((prev: StudentLead[]) => StudentLead[])) => {
    let resolvedLeads: StudentLead[];
    if (typeof newLeads === 'function') {
      resolvedLeads = newLeads(leads);
    } else {
      resolvedLeads = newLeads;
    }

    const orgId = session?.user.user_metadata?.organization_id;

    // Identify if it's a bulk addition
    if (resolvedLeads.length > leads.length) {
      const addedLeads = resolvedLeads.slice(leads.length).map(l => mapLeadToDb(l, orgId));
      await supabase.from('leads').insert(addedLeads);
    }
    // Identify if it's an update
    else if (resolvedLeads.length === leads.length) {
      const diff = resolvedLeads.find((l, i) => JSON.stringify(l) !== JSON.stringify(leads[i]));
      if (diff) {
        await supabase.from('leads').upsert(mapLeadToDb(diff, orgId));
      }
    }

    setLeads(resolvedLeads);
  }

  if (loading) return <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-main)', color: 'white' }}>Chargement Élite CRM...</div>

  return (
    <ToastProvider>
      {!session ? (
        <Login />
      ) : (
        <>
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} role={role} setRole={setRole} />
          <main className="main-content">
            {activeTab === 'dashboard' && <Dashboard leads={leads} campaigns={campaigns} />}
            {activeTab === 'campaigns' && <Campaigns campaigns={campaigns} setCampaigns={setCampaigns} leads={leads} setLeads={handleUpdateLeads as any} agents={agents} />}
            {activeTab === 'agents' && role === 'admin' && <Agents agents={agents} />}
            {activeTab === 'messaging' && <Messaging setLeads={handleUpdateLeads as any} agents={agents} />}
          </main>
        </>
      )}
    </ToastProvider>
  )
}

export default App
