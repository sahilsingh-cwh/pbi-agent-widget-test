import * as React from "react";

interface ConfigFormProps {
    currentEndpoint: string;
    currentApiKey: string;
    onSave: (endpoint: string, apiKey: string) => void;
}

/**
 * Simple in-visual configuration form.
 * Shown when the backend endpoint is not yet configured.
 * Values are persisted to the PBI report via persistProperties().
 */
export function ConfigForm({ currentEndpoint, currentApiKey, onSave }: ConfigFormProps) {
    const [endpoint, setEndpoint] = React.useState(currentEndpoint);
    const [apiKey, setApiKey] = React.useState(currentApiKey);

    const handleSave = () => {
        if (!endpoint.trim()) return;
        onSave(endpoint.trim(), apiKey.trim());
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "8px 12px",
        borderRadius: "6px",
        border: "1px solid #ccc",
        fontSize: "13px",
        boxSizing: "border-box",
        marginTop: "4px",
    };

    const labelStyle: React.CSSProperties = {
        fontSize: "13px",
        fontWeight: 600,
        color: "#333",
        display: "block",
        marginBottom: "12px",
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                height: "100%",
                padding: "24px",
                fontFamily: "'Segoe UI', sans-serif",
                background: "#fafafa",
                boxSizing: "border-box",
            }}
        >
            <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px", color: "#333" }}>
                ⚙️ Agent Chat Setup
            </div>
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "20px" }}>
                Enter your backend endpoint and API key to connect.
            </div>

            <label style={labelStyle}>
                Backend URL
                <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://us-central1-project.cloudfunctions.net/pbi-agent-chat"
                    style={inputStyle}
                />
            </label>

            <label style={labelStyle}>
                API Key
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your API key"
                    style={inputStyle}
                />
            </label>

            <button
                onClick={handleSave}
                disabled={!endpoint.trim()}
                style={{
                    marginTop: "8px",
                    padding: "10px 20px",
                    borderRadius: "20px",
                    border: "none",
                    background: endpoint.trim() ? "#0078d4" : "#ccc",
                    color: "#fff",
                    fontSize: "14px",
                    cursor: endpoint.trim() ? "pointer" : "not-allowed",
                    alignSelf: "flex-start",
                }}
            >
                Connect
            </button>
        </div>
    );
}
