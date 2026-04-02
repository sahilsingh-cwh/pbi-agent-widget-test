import * as React from "react";
import * as ReactDOM from "react-dom/client";
import powerbi from "powerbi-visuals-api";
import { ChatThread } from "./components/ChatThread";

// IMPORTANT: Update these values before building for deployment
const ENDPOINT = "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/pbi-agent-chat";
const API_KEY = "YOUR_API_KEY";

export class Visual implements powerbi.extensibility.visual.IVisual {
    private root: ReactDOM.Root;

    constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
        const element = options.element;
        this.root = ReactDOM.createRoot(element);
        this.render();
    }

    public update(options: powerbi.extensibility.visual.VisualUpdateOptions): void {
        this.render();
    }

    private render(): void {
        this.root.render(
            React.createElement(ChatThread, {
                endpoint: ENDPOINT,
                apiKey: API_KEY,
                locale: "en",
            })
        );
    }

    public destroy(): void {
        this.root.unmount();
    }
}

const pw = (window as any).powerbi;
if (pw) {
    pw.extensibility = pw.extensibility || {};
    pw.extensibility.visual = pw.extensibility.visual || {};
    pw.extensibility.visual.Visual = Visual;
}
