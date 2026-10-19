import { createSign, generateKeyPairSync, createPublicKey } from "node:crypto";
import { jwtVerify, createLocalJWKSet } from "jose";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const keyObject = createPublicKey(publicKey);
const jwk = keyObject.export({ format: "jwk" });
jwk.kid = "good-key";
jwk.alg = "RS256";
jwk.use = "sig";

const jwks = createLocalJWKSet({ keys: [jwk] });

const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: "https://example.access.com",
  aud: "app-aud",
  sub: "student@example.test",
  email: "student@example.test",
  exp: now + 3600,
  iat: now,
  nbf: now,
  tfp: "email",
  azp: "app-aud",
};
const header = { alg: "RS256", typ: "JWT", kid: "good-key" };
const signingInput = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
const signer = createSign("RSA-SHA256");
signer.update(signingInput);
signer.end();
const token = `${signingInput}.${signer.sign(privateKey, "base64url")}`;

try {
  const result = await jwtVerify(token, jwks, {
    issuer: "https://example.access.com",
    audience: "app-aud",
  });
  console.log("VERIFY OK:", result.payload.email);
} catch (e) {
  console.log("VERIFY FAILED:", e.message);
  console.log("CODE:", e.code);
}
