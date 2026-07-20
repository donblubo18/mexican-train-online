interface ClientPlayer {
    id: string;
    name: string;
    isOpen: boolean;
    train: [number, number][];
    totalScore: number;
    handCount: number;
}

export class TrainComponent {
    private container: HTMLElement | null;

    constructor() {
        this.container = document.getElementById('playerTracksContainer');
    }

    public render(players: ClientPlayer[], currentTurnIndex: number, myId: string): void {
        if (!this.container) return;
        this.container.innerHTML = "";

        players.forEach((p, idx) => {
            const isCurrent = currentTurnIndex === idx;

            const col = document.createElement("div");
            col.className = "train-column";
            if (isCurrent) {
                col.style.borderTop = "4px solid #f59e0b";
                col.style.backgroundColor = "rgba(245, 158, 11, 0.03)";
            }

            col.onclick = () => {
                if (typeof (window as any).selectTrain === "function") {
                    (window as any).selectTrain(p.id);
                }
            };

            let html = `<div class="column-header">
                <div class="title ${p.id === myId ? 'me' : ''}">${isCurrent ? '⭐ ' : ''}${p.name}</div>
                <div class="score-stn">${p.totalScore} pnt | ${p.handCount} stn</div>
                <div class="status-badge ${p.isOpen ? 'open' : ''}">${p.isOpen ? '🔓 OPEN' : '🔒 PRIVÉ'}</div>
                ${p.handCount === 1 ? "<div class='bounce-badge'>1 STEEN</div>" : ""}
            </div><div class="stones-scroll-area no-scrollbar"></div>`;
            
            col.innerHTML = html;

            const scrollArea = col.querySelector('.stones-scroll-area');
            if (scrollArea && Array.isArray(p.train)) {
                p.train.forEach(s => {
                    if (typeof (window as any).createStoneEl === "function") {
                        scrollArea.appendChild((window as any).createStoneEl(s, false));
                    }
                });
            }
            this.container!.appendChild(col);
        });
    }
}
