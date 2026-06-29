import React, { useState, useEffect, useCallback } from 'react';
import { Database, Plus, ToggleLeft, ToggleRight, List, Palette, Hash, FileCode } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { usePopup } from './Popup';
import RequirePermission from './RequirePermission';

type ParameterType = 'programs' | 'statuses' | 'classifications' | 'sources' | 'templates';

const Settings: React.FC = () => {
    const { addToast } = useToast();
    const { showConfirm } = usePopup();
    const [activeSection, setActiveSection] = useState<ParameterType>('programs');
    const [userRole, setUserRole] = useState<string>('agent');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);

    // Form states
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#6366f1');
    const [sortOrder, setSortOrder] = useState<number>(1);
    const [selectedLevels, setSelectedLevels] = useState<string[]>(['Licence 1']);
    const [templateChannel, setTemplateChannel] = useState('whatsapp');
    const [templateSubject, setTemplateSubject] = useState('');
    const [templateBody, setTemplateBody] = useState('');

    // CRUD Edit Mode state
    const [editingItem, setEditingItem] = useState<any | null>(null);

    // Status Delete Safety Modal
    const [statusToDelete, setStatusToDelete] = useState<any | null>(null);
    const [fallbackStatusId, setFallbackStatusId] = useState<string>('');

    useEffect(() => {
        const fetchRole = async () => {
            const { data: { session } } = await (supabase.auth as any).getSession();
            if (session) {
                const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
                if (data) setUserRole(data.role);
            }
        };
        fetchRole();
    }, []);

    const fetchItems = useCallback(async (section: ParameterType) => {
        setLoading(true);
        try {
            let res;
            if (section === 'programs') {
                res = await supabase.from('programs').select('*').order('created_at', { ascending: false });
            } else if (section === 'statuses') {
                res = await supabase.from('lead_statuses').select('*').order('sort_order');
            } else if (section === 'classifications') {
                res = await supabase.from('prospect_classifications').select('*').order('sort_order');
            } else if (section === 'templates') {
                res = await supabase.from('messaging_templates').select('*').order('created_at', { ascending: false });
            } else {
                res = await supabase.from('prospect_sources').select('*').order('created_at', { ascending: false });
            }

            if (res.error) throw res.error;
            setItems(res.data || []);
        } catch (err) {
            console.error(err);
            addToast("Erreur lors de la récupération des données", "error");
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        setEditingItem(null);
        setName('');
        setCode('');
        setDescription('');
        setTemplateSubject('');
        setTemplateBody('');
        setSelectedLevels(['Licence 1']);
        setColor('#6366f1');
        setSortOrder(1);
        fetchItems(activeSection);
    }, [activeSection, fetchItems]);

    const canEdit = ['admin', 'superagent'].includes(userRole);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) {
            addToast("Accès refusé : Seuls les administrateurs et superagents peuvent modifier les référentiels.", "error");
            return;
        }

        if (activeSection !== 'templates' && (!name || !code)) {
            addToast("Nom et Code internes obligatoires", "warning");
            return;
        }

        setLoading(true);
        try {
            let error;
            const orgId = '00000000-0000-0000-0000-000000000000'; // Default Tenant

            if (editingItem) {
                // UPDATE query
                if (activeSection === 'programs') {
                    const levelJson = JSON.stringify(selectedLevels);
                    const { error: err } = await supabase.from('programs').update({
                        name,
                        description,
                        level: levelJson
                    }).eq('id', editingItem.id);
                    error = err;

                    // Vérification
                    if (!err) {
                        const { data: verif } = await supabase
                            .from('programs')
                            .select('level')
                            .eq('id', editingItem.id)
                            .single();
                        if (verif && verif.level !== levelJson) {
                            addToast(
                                `⚠️ Le niveau a été écrasé par la base de données : "${verif.level}" au lieu de "${levelJson}".`,
                                'error'
                            );
                        }
                    }
                } else if (activeSection === 'statuses') {
                    const { error: err } = await supabase.from('lead_statuses').update({
                        label: name,
                        color,
                        sort_order: sortOrder
                    }).eq('id', editingItem.id);
                    error = err;
                } else if (activeSection === 'classifications') {
                    const { error: err } = await supabase.from('prospect_classifications').update({
                        name,
                        description,
                        color,
                        sort_order: sortOrder
                    }).eq('id', editingItem.id);
                    error = err;
                } else if (activeSection === 'templates') {
                    const { error: err } = await supabase.from('messaging_templates').update({
                        title: name,
                        category: templateChannel,
                        subject: templateChannel === 'email' ? templateSubject : null,
                        content: templateBody,
                        description: description || null
                    }).eq('id', editingItem.id);
                    error = err;
                } else {
                    const { error: err } = await supabase.from('prospect_sources').update({
                        name,
                        description
                    }).eq('id', editingItem.id);
                    error = err;
                }
            } else {
                // INSERT query
                if (activeSection === 'programs') {
                    const { error: err } = await supabase.from('programs').insert({
                        name,
                        code: code.toLowerCase().trim(),
                        description,
                        level: JSON.stringify(selectedLevels),
                        organization_id: orgId
                    });
                    error = err;
                } else if (activeSection === 'statuses') {
                    const { error: err } = await supabase.from('lead_statuses').insert({
                        id: code.toLowerCase().trim(),
                        label: name,
                        color,
                        sort_order: sortOrder,
                        organization_id: orgId
                    });
                    error = err;
                } else if (activeSection === 'classifications') {
                    const { error: err } = await supabase.from('prospect_classifications').insert({
                        name,
                        code: code.toLowerCase().trim(),
                        description,
                        color,
                        sort_order: sortOrder,
                        organization_id: orgId
                    });
                    error = err;
                } else if (activeSection === 'templates') {
                    const { error: err } = await supabase.from('messaging_templates').insert({
                        title: name,
                        category: templateChannel,
                        subject: templateChannel === 'email' ? templateSubject : null,
                        content: templateBody,
                        description: description || null,
                        organization_id: orgId
                    });
                    error = err;
                } else {
                    const { error: err } = await supabase.from('prospect_sources').insert({
                        name,
                        code: code.toLowerCase().trim(),
                        description,
                        organization_id: orgId
                    });
                    error = err;
                }
            }

            if (error) throw error;

            addToast(editingItem ? "Élément mis à jour avec succès !" : "Élément enregistré avec succès !", "success");
            setEditingItem(null);
            setName('');
            setCode('');
            setDescription('');
            setTemplateSubject('');
            setTemplateBody('');
            setSelectedLevels(['Licence 1']);
            setColor('#6366f1');
            setSortOrder(1);
            fetchItems(activeSection);
        } catch (err: any) {
            addToast("Erreur lors de l'enregistrement : " + err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (itemId: string, currentActive: boolean) => {
        if (!canEdit) return;

        try {
            let error;
            if (activeSection === 'programs') {
                const { error: err } = await supabase.from('programs').update({ is_active: !currentActive }).eq('id', itemId);
                error = err;
            } else if (activeSection === 'statuses') {
                addToast("Les statuts du pipeline ne peuvent pas être désactivés sans modifier la structure des colonnes.", "info");
                return;
            } else if (activeSection === 'classifications') {
                const { error: err } = await supabase.from('prospect_classifications').update({ is_active: !currentActive }).eq('id', itemId);
                error = err;
            } else if (activeSection === 'templates') {
                const { error: err } = await supabase.from('messaging_templates').update({ is_active: !currentActive }).eq('id', itemId);
                error = err;
            } else {
                const { error: err } = await supabase.from('prospect_sources').update({ is_active: !currentActive }).eq('id', itemId);
                error = err;
            }

            if (error) throw error;
            addToast("Statut de l'élément mis à jour !", "success");
            fetchItems(activeSection);
        } catch (err: any) {
            addToast("Erreur : " + err.message, "error");
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!canEdit) return;
        const confirmDelete = await showConfirm(
            "Supprimer l'élément ?",
            "Cette action est irréversible et pourrait affecter les prospects associés. Confirmer la suppression ?"
        );
        if (!confirmDelete) return;

        setLoading(true);
        try {
            let error;
            if (activeSection === 'programs') {
                const { error: err } = await supabase.from('programs').delete().eq('id', itemId);
                error = err;
            } else if (activeSection === 'statuses') {
                // Trouver le statut concerné
                const statusObj = items.find(i => i.id === itemId);
                const alternatives = items.filter(i => i.id !== itemId);
                
                if (alternatives.length === 0) {
                    addToast("Impossible de supprimer le dernier statut restant.", "error");
                    setLoading(false);
                    return;
                }

                setStatusToDelete(statusObj);
                setFallbackStatusId(alternatives[0].id);
                setLoading(false);
                return;
            } else if (activeSection === 'classifications') {
                const { error: err } = await supabase.from('prospect_classifications').delete().eq('id', itemId);
                error = err;
            } else if (activeSection === 'templates') {
                const { error: err } = await supabase.from('messaging_templates').delete().eq('id', itemId);
                error = err;
            } else {
                const { error: err } = await supabase.from('prospect_sources').delete().eq('id', itemId);
                error = err;
            }

            if (error) throw error;
            addToast("Élément supprimé avec succès !", "success");
            fetchItems(activeSection);
        } catch (err: any) {
            addToast("Erreur lors de la suppression : " + err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    // Fonction pour finaliser la suppression du statut avec migration des prospects
    const handleConfirmStatusDelete = async () => {
        if (!statusToDelete || !fallbackStatusId) return;
        setLoading(true);
        try {
            // 1. Migrer les prospects
            const { error: updateError } = await supabase
                .from('leads')
                .update({ status_id: fallbackStatusId })
                .eq('status_id', statusToDelete.id);

            if (updateError) throw updateError;

            // 2. Supprimer le statut
            const { error: deleteError } = await supabase
                .from('lead_statuses')
                .delete()
                .eq('id', statusToDelete.id);

            if (deleteError) throw deleteError;

            addToast(`Statut supprimé et prospects redirigés avec succès !`, "success");
            setStatusToDelete(null);
            fetchItems('statuses');
        } catch (err: any) {
            addToast("Erreur lors de la suppression : " + err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleStartEdit = (item: any) => {
        setEditingItem(item);
        setName(item.name || item.label || item.title || '');
        setCode(item.code || item.id || '');
        setDescription(item.description || '');
        
        // Parse level JSON if possible
        let parsedLevels = ['Licence 1'];
        if (item.level) {
            try {
                if (item.level.startsWith('[') && item.level.endsWith(']')) {
                    parsedLevels = JSON.parse(item.level);
                } else {
                    // Legacy formats (fallback)
                    parsedLevels = [item.level];
                }
            } catch {
                parsedLevels = [item.level];
            }
        }
        setSelectedLevels(parsedLevels);
        setColor(item.color || '#6366f1');     // always reset explicitly
        setSortOrder(item.sort_order || 1);    // always reset explicitly
        setTemplateChannel(item.category || 'whatsapp');
        setTemplateSubject(item.subject || '');
        setTemplateBody(item.content || '');
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
        setName('');
        setCode('');
        setDescription('');
        setTemplateSubject('');
        setTemplateBody('');
        setSelectedLevels(['Licence 1']);
        setColor('#6366f1');
        setSortOrder(1);
    };

    const sections = [
        { id: 'programs', label: 'Filières & Programmes' },
        { id: 'statuses', label: 'Statuts de Pipeline' },
        { id: 'classifications', label: 'Classements prospects' },
        { id: 'sources', label: "Sources d'acquisition" },
        { id: 'templates', label: 'Modèles de Messages' }
    ];

    return (
        <RequirePermission role={userRole} allowedRoles={['admin', 'superagent']}>
            <div className="settings-grid animate-fade">
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', height: 'fit-content' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '0.05em' }}>Référentiels Métier</h3>
                {sections.map((sec) => (
                    <button
                        key={sec.id}
                        onClick={() => setActiveSection(sec.id as ParameterType)}
                        className="btn"
                        style={{
                            width: '100%',
                            justifyContent: 'flex-start',
                            background: activeSection === sec.id ? 'var(--primary)' : 'transparent',
                            color: activeSection === sec.id ? 'white' : 'var(--text-muted)',
                            padding: '0.75rem 1.25rem',
                            borderRadius: '12px',
                            fontWeight: 700
                        }}
                    >
                        {sec.label}
                    </button>
                ))}
            </div>

            {/* Zone principale d'administration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.03em' }}>Configuration CRM</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Personnalisez les variables, les nomenclatures et les règles de qualification.</p>
                    </div>
                </div>

                <div className={`settings-split-grid ${canEdit ? '' : 'single'}`} style={{ gap: '2rem' }}>
                    {/* Liste des éléments du référentiel */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <List size={20} color="var(--primary)" />
                            Liste des Éléments
                        </h3>

                        {loading ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chargement des données...</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {items.map((item) => {
                                    const codeText = item.code || item.id;
                                    const activeState = item.is_active !== false;

                                    return (
                                        <div
                                            key={item.id}
                                            style={{
                                                padding: '1.25rem',
                                                borderRadius: '16px',
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                opacity: activeState ? 1 : 0.5
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                     <span style={{ fontWeight: 800, color: 'white' }}>{item.name || item.label || item.title}</span>
                                                    {item.color && (
                                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }}></span>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    {activeSection === 'templates' ? `Canal : ${item.category}` : `Code interne : ${codeText}`}
                                                </span>
                                                {item.level && (() => {
                                                    let displayLevels: string[] = [];
                                                    try {
                                                        if (item.level.startsWith('[') && item.level.endsWith(']')) {
                                                            displayLevels = JSON.parse(item.level);
                                                        } else {
                                                            displayLevels = [item.level];
                                                        }
                                                    } catch {
                                                        displayLevels = [item.level];
                                                    }
                                                    return (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                                            {displayLevels.map((lvl: string) => (
                                                                <span key={lvl} style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: '6px', color: 'var(--primary)', fontWeight: 600 }}>{lvl}</span>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {activeSection !== 'statuses' && (
                                                        <button
                                                            onClick={() => handleToggleActive(item.id, activeState)}
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                                        >
                                                            {activeState ? (
                                                                <ToggleRight size={32} color="var(--success)" />
                                                            ) : (
                                                                <ToggleLeft size={32} color="var(--text-muted)" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleStartEdit(item)}
                                                        style={{ 
                                                            background: 'rgba(99, 102, 241, 0.1)', 
                                                            color: 'var(--primary)', 
                                                            border: 'none', 
                                                            padding: '6px 12px', 
                                                            borderRadius: '8px', 
                                                            fontSize: '0.75rem', 
                                                            fontWeight: 700, 
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Modifier
                                                    </button>
                                                    {activeSection !== 'statuses' && (
                                                        <button
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            style={{ 
                                                                background: 'rgba(239, 68, 68, 0.1)', 
                                                                color: 'var(--danger)', 
                                                                border: 'none', 
                                                                padding: '6px 12px', 
                                                                borderRadius: '8px', 
                                                                fontSize: '0.75rem', 
                                                                fontWeight: 700, 
                                                                cursor: 'pointer',
                                                                transition: 'background 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                                                        >
                                                            Supprimer
                                                        </button>
                                                    )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {items.length === 0 && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>Aucun élément trouvé.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Formulaire d'ajout (visible uniquement pour les admins/superagents) */}
                    {canEdit && (
                        <div className="card" style={{ padding: '2rem', height: 'fit-content' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <Plus size={20} color="var(--primary)" />
                                Ajouter un élément
                            </h3>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                                        {activeSection === 'templates' ? 'Nom du modèle de message' : 'Libellé (Affichage)'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="input-field"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder={activeSection === 'templates' ? 'ex: Premier contact WhatsApp' : 'ex: Licence Architecture Logicielle'}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                                    />
                                </div>

                                {activeSection !== 'templates' && (
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Code unique interne (Non modifiable)</label>
                                        <input
                                            type="text"
                                            required
                                            disabled={!!editingItem}
                                            className="input-field"
                                            value={code}
                                            onChange={e => setCode(e.target.value)}
                                            placeholder="ex: lic_arch_log"
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: editingItem ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: editingItem ? 'var(--text-muted)' : 'white', cursor: editingItem ? 'not-allowed' : 'text' }}
                                        />
                                    </div>
                                )}

                                {activeSection === 'programs' && (
                                     <div className="form-group">
                                         <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Niveau(x) disponible(s)</label>
                                         <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                             {['Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2'].map(lvl => {
                                                 const isChecked = selectedLevels.includes(lvl);
                                                 return (
                                                     <label key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem', color: 'white' }}>
                                                         <input
                                                             type="checkbox"
                                                             checked={isChecked}
                                                             onChange={() => {
                                                                 if (isChecked) {
                                                                     setSelectedLevels(prev => prev.filter(x => x !== lvl));
                                                                 } else {
                                                                     setSelectedLevels(prev => [...prev, lvl]);
                                                                 }
                                                             }}
                                                             style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                                                         />
                                                         {lvl}
                                                     </label>
                                                 );
                                             })}
                                         </div>
                                     </div>
                                )}

                                {activeSection === 'templates' && (
                                    <>
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Canal de communication</label>
                                            <select
                                                value={templateChannel}
                                                onChange={e => setTemplateChannel(e.target.value)}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                                            >
                                                <option value="whatsapp" style={{background: '#1a1b1e'}}>WhatsApp</option>
                                                <option value="email" style={{background: '#1a1b1e'}}>Email</option>
                                            </select>
                                        </div>

                                        {templateChannel === 'email' && (
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Sujet du mail</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={templateSubject}
                                                    onChange={e => setTemplateSubject(e.target.value)}
                                                    placeholder="Objet de l'email..."
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                                                />
                                            </div>
                                        )}

                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Message (Corps)</label>
                                            <textarea
                                                required
                                                value={templateBody}
                                                onChange={e => setTemplateBody(e.target.value)}
                                                placeholder="Contenu du modèle de message..."
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', minHeight: '120px', resize: 'vertical' }}
                                            />
                                        </div>
                                    </>
                                )}

                                {(activeSection === 'statuses' || activeSection === 'classifications') && (
                                    <div className="grid-responsive-2" style={{ gap: '1rem' }}>
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Couleur</label>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    type="color"
                                                    value={color}
                                                    onChange={e => setColor(e.target.value)}
                                                    style={{ width: '40px', height: '40px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={color}
                                                    onChange={e => setColor(e.target.value)}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Ordre de tri</label>
                                            <input
                                                type="number"
                                                value={sortOrder}
                                                onChange={e => setSortOrder(parseInt(e.target.value) || 1)}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Description</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Description optionnelle..."
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', minHeight: '85px', resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {editingItem && (
                                        <button 
                                            type="button" 
                                            onClick={handleCancelEdit} 
                                            className="btn" 
                                            style={{ flex: 1, padding: '0.875rem', background: 'rgba(255,255,255,0.05)', color: 'white', justifyContent: 'center' }}
                                        >
                                            Annuler
                                        </button>
                                    )}
                                    <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '0.875rem', justifyContent: 'center' }}>
                                        {editingItem ? "Mettre à jour l'élément" : "Enregistrer l'élément"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                {/* Modal de redirection sécurisée pour la suppression d'un statut */}
                {statusToDelete && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center',
                        zIndex: 2000, padding: '1rem'
                    }}>
                        <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'white' }}>⚠️ Action requise : Statut de repli</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                                    Vous vous apprêtez à supprimer le statut <strong>"{statusToDelete.label}"</strong>. 
                                    Tous les prospects actuellement dans ce statut doivent être déplacés vers un autre statut de votre choix.
                                </p>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    Choisir le statut de transfert
                                </label>
                                <select
                                    value={fallbackStatusId}
                                    onChange={e => setFallbackStatusId(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                                >
                                    {items.filter(i => i.id !== statusToDelete.id).map(status => (
                                        <option key={status.id} value={status.id} style={{ background: '#1a1b1e' }}>
                                            {status.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button 
                                    onClick={() => setStatusToDelete(null)} 
                                    className="btn" 
                                    style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', color: 'white', justifyContent: 'center' }}
                                >
                                    Annuler
                                </button>
                                <button 
                                    onClick={handleConfirmStatusDelete} 
                                    className="btn btn-primary" 
                                    style={{ flex: 2, background: 'var(--danger)', borderColor: 'var(--danger)', justifyContent: 'center' }}
                                    disabled={loading}
                                >
                                    {loading ? 'Migration...' : 'Migrer et Supprimer'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
</RequirePermission>
);
};

export default Settings;
