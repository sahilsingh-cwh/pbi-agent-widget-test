import * as React from "react";
import * as ReactDOM from "react-dom/client";
import powerbi from "powerbi-visuals-api";
import { ChatThread } from "./components/ChatThread";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;

/** Settings surfaced in the Power BI Format pane — no secrets in source code. */
interface AgentSettings {
    endpoint: string;
    apiKey: string;
}

/** Safely read agentSettings from the Power BI Format pane (dataView metadata). */
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
    private root: ReactDOM.Root;
    private settings: AgentSettings = { endpoint: "", apiKey: "" };

    constructor(options: VisualConstructorOptions) {
        this.root = ReactDOM.createRoot(options.element);
        this.render();
    }

    /** Called by Power BI whenever the visual or its properties change. */
    public update(options: VisualUpdateOptions): void {
        this.settings = readSettings(options.dataViews);
        this.render();
    }

    /**
     * Modern Format pane API (PBI API 5.1+).
     * Returns a FormattingModel so report authors can configure
     * backend URL and API key without rebuilding the visual.
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return {
            cards: [
                {
                    displayName: "Agent Configuration",
                    uid: "agentSettings_card",
                    groups: [
                        {
                            displayName: undefined as any,
                            uid: "agentSettings_group",
                            slices: [
                                {
                                    uid: "agentSettings_endpoint",
                                    displayName: "Agent Endpoint URL",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.TextInput,
                                        properties: {
                                            descriptor: {
                                                objectName: "agentSettings",
                                                propertyName: "endpoint",
                                            },
                                            value: this.settings.endpoint,
                                        },
                                    },
                                } as any,
                                {
                                    uid: "agentSettings_apiKey",
                                    displayName: "API Key",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.TextInput,
                                        properties: {
                                            descriptor: {
                                                objectName: "agentSettings",
                                                propertyName: "apiKey",
                                            },
                                            value: this.settings.apiKey,
                                        },
                                    },
                                } as any,
                            ],
                        },
                    ],
                },
            ],
        };
    }

    private render(): void {
        this.root.render(
            React.createElement(ChatThread, {
                endpoint: this.settings.endpoint,
                apiKey:   this.settings.apiKey,
                locale:   "en",
            })
        );
    }

    public destroy(): void {
        this.root.unmount();
    }
}

// Fallback registration for the custom webpack UMD build
const pw = (window as any).powerbi;
if (pw) {
    pw.extensibility = pw.extensibility || {};
    pw.extensibility.visual = pw.extensibility.visual || {};
    pw.extensibility.visual.Visual = Visual;
}
