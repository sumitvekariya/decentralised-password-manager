import { utils } from "ethers";
import { create, IPFS } from "ipfs-core";

let ipfs: IPFS;

export const getContent = async (CID: string) => {
    if (!ipfs) {
        ipfs = await create();
    }
    const decoder = new TextDecoder()
    let content = ''

    for await (const chunk of ipfs.cat(CID)) {
        // chunks of data are returned as a Uint8Array, convert it back to a string
        content += decoder.decode(chunk, { stream: true })
    }

    const indexMark = content.indexOf("#")
    if (indexMark >= 0) {
        return content.substring(indexMark + 1)
    }
    return content
}

export const getIpfsHashFromBytes32 = (bytes32Hex: string): string => {
    // Add our default ipfs values for first 2 bytes:
    // function:0x12=sha2, size:0x20=256 bits
    // and cut off leading "0x"
    const hashHex = "1220" + bytes32Hex.slice(2)
    const hashBytes = Buffer.from(hashHex, "hex")
    const hashStr = utils.base58.encode(hashBytes)
    return hashStr
}

export const getBytes32FromIpfsHash = (ipfsListing: string): string => {
    return "0x" + Buffer.from(utils.base58.decode(ipfsListing).slice(2)).toString("hex")
}

export const uploadIPFS = async (message: string) => {
    if (!ipfs) {
        ipfs = await create();
    }
    try {
        const result = await ipfs.add(new TextEncoder().encode(message))
        return result.path
    } catch (err) {
        console.error("Error pinning file to IPFS", err)
        return null
    }
}

export const hashBytes = (signal: string): BigInt => {
    return BigInt(utils.keccak256(signal)) >> BigInt(8)
}