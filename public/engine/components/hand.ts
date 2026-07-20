export class HandComponent {
    private element: HTMLElement | null;

    constructor() {
        this.element = document.getElementById('myHand');
    }

    public render(myHand: [number, number][], isSpectator: boolean, onStoneClick: (idx: number, val: string) => void): void {
        if (!this.element) return;
        this.element.innerHTML = "";

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
            if (typeof (window as any).createStoneEl === "function") {
                const stoneEl = (window as any).createStoneEl(s, true, idx);
                stoneEl.style.flexShrink = "0"; 
                this.element!.appendChild(stoneEl);
            }
        });
    }
}
