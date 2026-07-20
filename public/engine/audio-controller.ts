export class AudioController {
    private sounds: { [key: string]: HTMLAudioElement };

    constructor() {
        this.sounds = {
            turn: new Audio('/sounds/turn.mp3'),
            trainOpen: new Audio('/sounds/trainOpen.mp3'),
            knock: new Audio('/sounds/knock.mp3')
        };
    }

    public unlock(): void {
        Object.values(this.sounds).forEach(audio => {
            audio.muted = true;
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
            }).catch(() => {});
        });
    }

    public play(type: 'turn' | 'trainOpen' | 'knock'): void {
        if (this.sounds[type]) {
            this.sounds[type].play().catch(() => {});
        }
    }
}
