import * as React from "react";
import * as ReactDOM from "react-dom/client";
import powerbi from "powerbi-visuals-api";
import { ChatThread } from "./components/ChatThread";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import VisualObjectInstance = powerbi.VisualObjectInstance;
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
     * Populates the Format pane so report authors can configure
     * backend URL and API key at design time — no rebuild required.
     */
    public enumerateObjectInstances(
        options: EnumerateVisualObjectInstancesOptions
    ): VisualObjectInstanceEnumeration {
        if (options.objectName === "agentSettings") {
            const inst: VisualObjectInstance = {
                objectName: "agentSettings",
                selector: null,
                properties: {
                    endpoint: this.settings.endpoint,
                    apiKey:   this.settings.apiKey,
                },
            };
            return [inst];
        }
        return [];
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
