export class AudioController {
    private sounds: { [key: string]: HTMLAudioElement };

    constructor() {
        this.sounds = {
            turn: new Audio('/sounds/turn.mp3'),
            trainOpen: new Audio('/sounds/trainOpen.mp3'),
            knock: new Audio('/sounds/knock.mp3')
        };
    }

    // Moet aangeroepen worden bij de eerste klik (Join, Spectate of Start)
    public unlock(): void {
        console.log("AudioController: Browser toestemming aanvragen...");
        Object.values(this.sounds).forEach(audio => {
            audio.muted = true;
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
            }).catch(err => console.warn("Audio unlock mislukt:", err));
        });
    }

    public play(type: 'turn' | 'trainOpen' | 'knock'): void {
        if (this.sounds[type]) {
            this.sounds[type].play().catch(e => 
                console.log("Audio geblokkeerd door browser, wacht op interactie.", e)
            );
        }
    }
}
