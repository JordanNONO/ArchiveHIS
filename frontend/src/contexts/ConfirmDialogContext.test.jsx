import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfirmDialogProvider, useConfirm } from './ConfirmDialogContext';

/**
 * jsdom n'implémente ni showModal() ni close() sur <dialog> : on les simule
 * en tenant `open` à jour, ce qui suffit à vérifier que la confirmation passe
 * bien par la "top layer" du navigateur — le fond de l'affaire, puisque c'est
 * la seule couche capable de s'afficher au-dessus d'une autre <dialog>
 * ouverte avec showModal() (ArchiverDocumentModal).
 */
function simulerDialogNatif() {
    const appels = { showModal: 0, close: 0 };
    HTMLDialogElement.prototype.showModal = function () {
        appels.showModal += 1;
        this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
        appels.close += 1;
        this.open = false;
    };
    return appels;
}

/** Bouton qui déclenche une confirmation et affiche la réponse obtenue. */
function Declencheur({ options }) {
    const confirm = useConfirm();
    const [reponse, setReponse] = React.useState('(en attente)');
    return (
        <>
            <button onClick={async () => setReponse(String(await confirm(options)))}>Déclencher</button>
            <span data-testid="reponse">{reponse}</span>
        </>
    );
}

function monter(options = { message: 'Ce fichier existe déjà. Archiver quand même ?', confirmLabel: 'Archiver quand même' }) {
    const appels = simulerDialogNatif();
    render(
        <ConfirmDialogProvider>
            <Declencheur options={options} />
        </ConfirmDialogProvider>
    );
    return appels;
}

describe('ConfirmDialogProvider', () => {
    test("la confirmation s'ouvre via showModal() — sans quoi elle resterait sous la modale appelante", async () => {
        const appels = monter();
        expect(appels.showModal).toBe(0);

        fireEvent.click(screen.getByText('Déclencher'));

        await waitFor(() => expect(appels.showModal).toBe(1));
        expect(screen.getByText('Ce fichier existe déjà. Archiver quand même ?')).toBeInTheDocument();
    });

    test('le bouton de confirmation renvoie true et referme la boîte', async () => {
        const appels = monter();
        fireEvent.click(screen.getByText('Déclencher'));

        await waitFor(() => expect(screen.getByText('Archiver quand même')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Archiver quand même'));

        await waitFor(() => expect(screen.getByTestId('reponse')).toHaveTextContent('true'));
        expect(appels.close).toBe(1);
    });

    test('Annuler renvoie false', async () => {
        monter();
        fireEvent.click(screen.getByText('Déclencher'));

        await waitFor(() => expect(screen.getByText('Annuler')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Annuler'));

        await waitFor(() => expect(screen.getByTestId('reponse')).toHaveTextContent('false'));
    });

    test("Échap renvoie false au lieu de laisser l'appelant attendre indéfiniment", async () => {
        const { container } = { container: document.body };
        monter();
        fireEvent.click(screen.getByText('Déclencher'));

        await waitFor(() => expect(container.querySelector('dialog')?.open).toBe(true));
        fireEvent(container.querySelector('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));

        await waitFor(() => expect(screen.getByTestId('reponse')).toHaveTextContent('false'));
    });

    test('rien ne s\'affiche tant qu\'aucune confirmation n\'est demandée', () => {
        monter();
        expect(document.querySelector('dialog').open).toBeFalsy();
        expect(screen.queryByText('Annuler')).not.toBeInTheDocument();
    });
});
