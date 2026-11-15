// paroxysm configuration. This is the file to edit; nothing else needs to change.
window.PAROXYSM_CONFIG = {
    // Built-in wisp servers, tried in this order unless you pick one in Settings > Proxy.
    // They are stored encoded and shown in the UI as "Wisp Server 1", "Wisp Server 2", ...
    // To change the list, run `python encode_wisp.py urls.txt` (one wss:// URL per line)
    // and paste its output here.
    // The encoding only keeps the URLs out of plain sight in the repository and the interface.
    // It is not a secret: anyone with developer tools can still see which server paroxysm uses.
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

    // Shown in Settings > About. Anything left empty is not shown.
    version: "0.3.0",
    developers: "lynverix",
    gameSource: "LuminSDK",
    aiProvider: "",
    extensions: "x8rr/sapphire",
    uiInspiration: "Fern, Refract"
};