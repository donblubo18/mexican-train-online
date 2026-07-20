import { Player } from '../models/player';

export class TrainComponent {
    private container: HTMLElement;

    constructor() {
        this.container = document.getElementById('playerTracksContainer')!;
    }

    public render(players: Player[], currentTurnIndex: number, myId: string): void {
        if (!this.container) return;
        this.container.innerHTML = "";

        players.forEach((p, idx) => {
            const isCurrent = currentTurnIndex === idx; // Is deze specifieke kolom aan de beurt?
            
            const col = document.createElement("div");
            col.className = "train-column";
            
            // Geef de actieve kolom een goudkleurige beurtrand op het bord
            if (isCurrent) {
                col.style.borderTop = "4px solid #f59e0b";
                col.style.backgroundColor = "rgba(245, 158, 11, 0.03)";
            }

            // HIER IS HET STERRETJE GEPLAATST: Alleen voor de naam van de actieve speler!
            let html = `<div class="column-header">
                <div class="title ${p.id === myId ? 'me' : ''}">${isCurrent ? '⭐ ' : ''}${p.name}</div>
                <div class="score-stn">${p.totalScore} pnt</div>
                <div class="status-badge ${p.isOpen ? 'open' : ''}">${p.isOpen ? '🔓 OPEN' : '🔒 PRIVÉ'}</div>
            </div><div class="stones-scroll-area no-scrollbar"></div>`;
            
            col.innerHTML = html;
            // Vul de scroll-area daarna met de stenen uit p.train...
            
            this.container.appendChild(col);
        });
    }
}
