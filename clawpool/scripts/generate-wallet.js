const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
    const wallet = ethers.Wallet.createRandom();
    console.log("Address:", wallet.address);
    console.log("Private Key:", wallet.privateKey);
    
    const envPath = path.join(__dirname, "../.env");
    const content = `PRIVATE_KEY=${wallet.privateKey}\nDEPLOYER_ADDRESS=${wallet.address}\n`;
    
    if (!fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, content);
        console.log(".env created with new wallet.");
    } else {
        console.log(".env exists. Skipping generation.");
    }
}

main();
