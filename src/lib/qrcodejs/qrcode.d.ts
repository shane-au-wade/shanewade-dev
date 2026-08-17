export interface QRCodeOptions {
    text?: string;
    width?: number;
    height?: number;
    colorDark?: string;
    colorLight?: string;
    correctLevel?: number;
    useSVG?: boolean;
}

declare class QRCode {
    constructor(el: HTMLElement | string, options?: string | QRCodeOptions);
    makeCode(text: string): void;
    clear(): void;
    static CorrectLevel: { L: number; M: number; Q: number; H: number };
}

export default QRCode;
