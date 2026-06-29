import type { StudentLead } from '../types';

export const isNewLead = (lead: StudentLead): boolean => {
    const sid = (lead.statusId || '').toLowerCase();
    const slabel = (lead.status?.label || '').toLowerCase();
    return (
        sid === 'nouveau' ||
        sid === '' ||
        sid === 'non_contacte' ||
        slabel.includes('nouveau') ||
        slabel.includes('non contacté') ||
        slabel.includes('pas contacté')
    );
};

export const isInscribedLead = (lead: StudentLead): boolean => {
    const sid = (lead.statusId || '').toLowerCase();
    const slabel = (lead.status?.label || '').toLowerCase();
    return ['inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
};

export const isAdmittedLead = (lead: StudentLead): boolean => {
    const sid = (lead.statusId || '').toLowerCase();
    const slabel = (lead.status?.label || '').toLowerCase();
    return sid === 'admis' || slabel.includes('admis');
};

export const isFailedLead = (lead: StudentLead): boolean => {
    const sid = (lead.statusId || '').toLowerCase();
    const slabel = (lead.status?.label || '').toLowerCase();
    return (
        sid === 'injoignable' ||
        sid === 'repondeur' ||
        sid === 'faux_numero' ||
        slabel.includes('injoignable') ||
        slabel.includes('répondeur')
    );
};

export const isDialogueLead = (lead: StudentLead): boolean => {
    return !isNewLead(lead) && !isFailedLead(lead);
};

export const getLeadPhase = (lead: StudentLead): string => {
    const sid = (lead.statusId || '').toLowerCase();
    if (['admis', 'inscription_attente', 'inscrit'].includes(sid)) return 'Décision';
    if (['rdv_planifie', 'dossier_recu'].some(k => sid.includes(k))) return 'Candidature';
    if (['interesse', 'rappel', 'reflexion', 'reorientation'].some(k => sid.includes(k))) return 'Information';
    return 'Qualification';
};
