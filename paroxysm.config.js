// paroxysm configuration
window.PAROXYSM_CONFIG = {
    // built-in wisp servers in try order (encoded; shown as "Wisp Server N")
    // regenerate with: python encode_wisp.py urls.txt
    // encoding hides URLs from casual view; not a secret
    wispServers: [
        "L2l3L2dyby5zZWxwZXJwc2xyaWcvLzpzc3c=",
        "L2l3L3Rlbi5hc2FjeG9iLy86c3N3",
        "L2l3L2dyby5odGFtdmNzLmlwYS8vOnNzdw==",
        "L2l3L21vYy5zcG1hY2xsYWJ5ZWxsb3ZucnVia2NhbGJuZXRzaXJrLnBvaHMvLzpzc3c=",
        "L2l3L21vYy5nbmlkcmFvYmV0aWtkbmFsc2llcmRhcGh0dW9zLm5yYWVsLy86c3N3",
        "L3Rla2Nvcy9tb2MuZXJvdHNnb2RhbmFuYWIvLzpzc3c=",
        "L3Rla2Nvcy9tb2Muc2xsaWhlbHBtZXQtc3RyYWxhaXRyYW1zdWxwYS8vOnNzdw==",
        "L3Rla2Nvcy9tb2Mucm9vZHR1b2duaXRjYS8vOnNzdw==",
        "L3Rla2Nvcy9ncm8ucmV0bmVjZ25pbGVzbnVvY2Vyb3RzZXIvLzpzc3c="
    ],

    // optional shared key for AI page (Gemma 4 only); empty = users paste their own
    // visible to anyone; Google may block it if found in a public repo
    aiKey: "",

    // shown in Settings > About; empty entries are hidden
    version: "0.3.0",
    developers: "lynverix",
    gameSource: "gn-math | LuminSDK",
    aiProvider: "Pollinations | Puter, Google Gemini, DeepSeek",
    extensions: "",
    uiInspiration: "Fern, Refract"
};