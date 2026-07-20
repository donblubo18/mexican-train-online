import { DominoStone } from '../models/domino';

export class HandComponent {
    private element: HTMLElement;

    constructor() {
        this.element = document.getElementById('myHand')!;
    }

    public render(myHand: DominoStone[], isSpectator: boolean, onStoneClick: (idx: number, val: string) => void): void {
        if (!this.element) return;
        this.element.innerHTML = "";

        // FORCEER HORIZONTALE SCROLL VIA CSS INJECTION
        this.element.style.display = "flex";
        this.element.style.flexDirection = "row";
        this.element.style.flexWrap = "nowrap";
        this.element.style.overflowX = "auto";
        this.element.style.justifyContent = "flex-start";
        this.element.style.padding = "5px";
        this.element.style.width = "100%";

        if (isSpectator) {
            const specDiv = document.createElement("div");
            specDiv.style.color = "#94a3b8";
            specDiv.style.fontSize = "12px";
            specDiv.style.fontStyle = "italic";
            specDiv.style.padding = "10px";
            specDiv.innerText = "Je kijkt live mee.";
            this.element.appendChild(specDiv);
            return;
        }

        myHand.forEach((s, idx) => {
            const btn = document.createElement("button");
            btn.className = "domino";
            btn.style.flexShrink = "0"; // Voorkomt dat stenen worden platgedrukt!
            
            // Klik- en sleepacties hier koppelen...
            btn.onclick = () => onStoneClick(idx, s.join("|"));
            
            btn.innerHTML = `<span>${s[0]}</span><div class='line'></div><span>${s[1]}</span>`;
            this.element.appendChild(btn);
        });
    }
}
