import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LuSlidersHorizontal, LuGripVertical, LuEye, LuEyeOff, LuRotateCcw } from 'react-icons/lu';

/**
 * Bouton + panneau pour réordonner/masquer les colonnes d'un tableau, par
 * personne (voir useColonnesPersonnalisees — mémorisé par appareil, même
 * principe que la personnalisation des cartes du tableau de bord dans
 * Home.jsx). `colonnes` est la liste déjà triée (colonnesTriees du hook,
 * pas seulement les visibles : il faut pouvoir re-cocher une colonne
 * masquée).
 */
function LigneColonne({ colonne, cachee, onToggle, t }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colonne.cle });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 20 : undefined };
  return (
    <div ref={setNodeRef} style={style} className='flex items-center gap-2 rounded-lg px-1.5 py-1.5 bg-card'>
      <span {...attributes} {...listeners} className='flex items-center justify-center w-6 h-6 text-muted-foreground/60 cursor-grab active:cursor-grabbing touch-manipulation shrink-0'>
        <LuGripVertical size={14} />
      </span>
      <span className={`flex-1 min-w-0 truncate text-sm ${cachee ? 'text-muted-foreground' : 'text-foreground'}`}>{colonne.label}</span>
      <button
        type='button'
        onClick={() => onToggle(colonne.cle)}
        title={cachee ? t('commun.afficherColonne') : t('commun.masquerColonne')}
        className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
      >
        {cachee ? <LuEyeOff size={14} /> : <LuEye size={14} />}
      </button>
    </div>
  );
}

function PersonnaliserColonnes({ colonnesTriees, ordre, setOrdre, cachees, setCachees, reinitialiser }) {
  const { t } = useTranslation();
  const [ouvert, setOuvert] = useState(false);
  const panneauRef = useRef(null);

  useEffect(() => {
    function onClickExterieur(e) {
      if (panneauRef.current && !panneauRef.current.contains(e.target)) setOuvert(false);
    }
    document.addEventListener('mousedown', onClickExterieur);
    return () => document.removeEventListener('mousedown', onClickExterieur);
  }, []);

  const capteurs = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ancienIndex = ordre.indexOf(active.id);
    const nouvelIndex = ordre.indexOf(over.id);
    setOrdre(arrayMove(ordre, ancienIndex, nouvelIndex));
  }

  function toggle(cle) {
    setCachees(cachees.includes(cle) ? cachees.filter((c) => c !== cle) : [...cachees, cle]);
  }

  return (
    <div ref={panneauRef} className='relative'>
      <button
        type='button'
        onClick={() => setOuvert((v) => !v)}
        title={t('commun.personnaliserColonnes')}
        className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${ouvert ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}
      >
        <LuSlidersHorizontal size={15} />
      </button>

      {ouvert && (
        <div className='absolute right-0 top-full mt-2 z-30 w-64 rounded-xl border border-border bg-card shadow-lg overflow-hidden'>
          <div className='flex items-center justify-between px-3 py-2.5 border-b border-border'>
            <span className='text-xs font-semibold text-foreground'>{t('commun.personnaliserColonnes')}</span>
            <button type='button' onClick={reinitialiser} className='inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors'>
              <LuRotateCcw size={11} /> {t('commun.reinitialiser')}
            </button>
          </div>
          <div className='max-h-[320px] overflow-y-auto p-1.5 flex flex-col gap-0.5'>
            <DndContext sensors={capteurs} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ordre} strategy={verticalListSortingStrategy}>
                {colonnesTriees.map((col) => (
                  <LigneColonne key={col.cle} colonne={col} cachee={cachees.includes(col.cle)} onToggle={toggle} t={t} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonnaliserColonnes;
