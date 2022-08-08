import { run } from "hardhat";
const getErrorMsg = (e: unknown): String => {
    if (e instanceof Error) return e.message;
    else {
        try {
            return JSON.stringify(e);
        } catch (err) {
            return String(e);
        }
    }
};

export const verify = async (contractAddress: String, args: any[]): Promise<void> => {
    console.log("Verifying...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e: any) {
        if (getErrorMsg(e).toLowerCase().includes("already verified"))
            console.log("Already verified...");
        else console.error(e.message);
    }
};
