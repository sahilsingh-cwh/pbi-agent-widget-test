import * as React from "react";
import * as ReactDOM from "react-dom/client";
import powerbi from "powerbi-visuals-api";
import { ChatThread } from "./components/ChatThread";
import { ConfigForm } from "./components/ConfigForm";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

/** Settings stored in the PBI report — no secrets in source code. */
interface AgentSettings {
    endpoint: string;
    apiKey: string;
}

/** Read agentSettings from the Power BI dataView metadata objects. */
function readSettings(dataViews: DataView[] | undefined): AgentSettings {
    const empty: AgentSettings = { endpoint: "", apiKey: "" };
    const obj = dataViews?.[0]?.metadata?.objects;
    if (!obj?.agentSettings) return empty;
    const s = obj.agentSettings as Record<string, unknown>;
    return {
        endpoint: typeof s.endpoint === "string" ? s.endpoint : empty.endpoint,
        apiKey:   typeof s.apiKey   === "string" ? s.apiKey   : empty.apiKey,
    };
}

export class Visual implements IVisual {
    private container: HTMLElement;
    private root: ReactDOM.Root | null = null;
    private host: IVisualHost;
    private settings: AgentSettings = { endpoint: "", apiKey: "" };

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.container = options.element;

        // Force the container to fill the visual viewport
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.overflow = "auto";
        this.container.style.position = "relative";

        try {
            this.root = ReactDOM.createRoot(this.container);
            this.render();
        } catch (err) {
            // If React fails entirely, show a plain HTML fallback so
            // the user can at least see something in the visual container
            this.container.innerHTML =
                '<div style="padding:24px;font-family:Segoe UI,sans-serif">' +
                '<h3 style="color:red">⚠️ Visual failed to initialise</h3>' +
                "<p>" + String(err) + "</p></div>";
        }
    }

    /** Called by Power BI whenever the visual or its properties change. */
    public update(options: VisualUpdateOptions): void {
        this.settings = readSettings(options.dataViews);
        this.render();
    }

    /**
     * Save endpoint/apiKey into the PBI report's object model.
     * This persists the values so they survive refresh, save, and re-open.
     */
    private saveSettings(endpoint: string, apiKey: string): void {
        this.settings = { endpoint, apiKey };
        const changes: powerbi.VisualObjectInstancesToPersist = {
            merge: [
                {
                    objectName: "agentSettings",
                    selector: undefined as any,
                    properties: {
                        endpoint,
                        apiKey,
                    },
                },
            ],
        };
        this.host.persistProperties(changes);
        this.render();
    }

    private render(): void {
        if (!this.root) return;

        const isConfigured = !!this.settings.endpoint;

        try {
            if (!isConfigured) {
                // Show config form when endpoint is not set
                this.root.render(
                    React.createElement(ConfigForm, {
                        currentEndpoint: this.settings.endpoint,
                        currentApiKey:   this.settings.apiKey,
                        onSave: (ep: string, key: string) => this.saveSettings(ep, key),
                    })
                );
            } else {
                // Show chat when configured
                this.root.render(
                    React.createElement(ChatThread, {
                        endpoint: this.settings.endpoint,
                        apiKey:   this.settings.apiKey,
                        locale:   "en",
                        onReconfigure: () => this.saveSettings("", ""),
                    })
                );
            }
        } catch (err) {
            this.container.innerHTML =
                '<div style="padding:24px;font-family:Segoe UI,sans-serif">' +
                '<h3 style="color:red">⚠️ Render error</h3>' +
                "<p>" + String(err) + "</p></div>";
        }
    }

    public destroy(): void {
        if (this.root) {
            this.root.unmount();
        }
    }
}
