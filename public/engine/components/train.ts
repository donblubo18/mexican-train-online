// Maak een lokale interface aan voor de data die Socket.io naar de browser stuurt.
// Hierdoor hoef je GEEN backend-bestanden meer te importeren!
interface ClientPlayer {
    id: string;
    name: string;
    isOpen: boolean;
    train: [number, number][];
    totalScore: number;
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
            const handLen = 0; // Wordt dynamisch berekend of meegegeven via de game-state

            const col = document.createElement("div");
            col.className = "train-column";
            
            // Geef de actieve kolom een goudkleurige beurtrand op het bord
            if (isCurrent) {
                col.style.borderTop = "4px solid #f59e0b";
                col.style.backgroundColor = "rgba(245, 158, 11, 0.03)";
            }

            // Gebruik een inline click-handler om de gekozen trein te selecteren
            col.onclick = () => {
                if (typeof (window as any).selectTrain === "function") {
                    (window as any).selectTrain(p.id);
                }
            };

            // Het beurtsterretje (⭐) staat direct voor de naam van de actieve speler in de kolomkop
            let html = `<div class="column-header">
                <div class="title ${p.id === myId ? 'me' : ''}">${isCurrent ? '⭐ ' : ''}${p.name}</div>
                <div class="score-stn">${p.totalScore} pnt</div>
                <div class="status-badge ${p.isOpen ? 'open' : ''}">${p.isOpen ? '🔓 OPEN' : '🔒 PRIVÉ'}</div>
            </div><div class="stones-scroll-area no-scrollbar"></div>`;
            
            col.innerHTML = html;

            // Zoek de scroll-area binnen deze specifieke kolom om de stenen in te hangen
            const scrollArea = col.querySelector('.stones-scroll-area');
            if (scrollArea && Array.isArray(p.train)) {
                p.train.forEach(s => {
                    if (typeof (window as any).createStoneEl === "function") {
                        scrollArea.appendChild((window as any).createStoneEl(s, false));
                    }
                });
            }
            
            this.container.appendChild(col);
        });
    }
}
