import powerbi from "powerbi-visuals-api";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

/**
 * Minimal test visual — plain HTML, no React.
 * If this renders on the PBI canvas, the packaging pipeline works.
 */
export class Visual implements IVisual {
    private container: HTMLElement;
    private updateCount: number = 0;

    constructor(options: VisualConstructorOptions) {
        this.container = options.element;

        // Force the container to fill the visual viewport
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.overflow = "auto";
        this.container.style.fontFamily = "'Segoe UI', sans-serif";
        this.container.style.padding = "20px";
        this.container.style.boxSizing = "border-box";
        this.container.style.background = "#fafafa";

        this.container.innerHTML = `
            <div style="text-align:center; margin-top:40px">
                <h2 style="color:#0078d4; margin:0 0 8px 0">✅ Agent Chat Visual Loaded</h2>
                <p style="color:#555; font-size:14px">
                    The visual is working! Waiting for first update()…
                </p>
            </div>
        `;
    }

    public update(options: VisualUpdateOptions): void {
        this.updateCount++;
        this.container.innerHTML = `
            <div style="text-align:center; margin-top:40px">
                <h2 style="color:#0078d4; margin:0 0 8px 0">✅ Agent Chat Visual Loaded</h2>
                <p style="color:#555; font-size:14px">
                    Visual is alive! update() called <strong>${this.updateCount}</strong> time(s).
                </p>
                <p style="color:#888; font-size:12px; margin-top:16px">
                    Viewport: ${options.viewport.width.toFixed(0)} × ${options.viewport.height.toFixed(0)} px
                </p>
            </div>
        `;
    }

    public destroy(): void {
        this.container.innerHTML = "";
    }
}
