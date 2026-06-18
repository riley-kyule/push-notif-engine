import crypto from "node:crypto";
import http2 from "node:http2";

import type { MobilePushCredentialsRecord, MobilePushNotificationPayload } from "./mobile-push.types";

export interface MobilePushDevice {
  deviceToken: string;
  platform: "ios" | "android";
}

export interface MobilePushSender {
  send(
    credentials: MobilePushCredentialsRecord,
    device: MobilePushDevice,
    payload: MobilePushNotificationPayload,
  ): Promise<{ providerMessageId: string | null }>;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toPem(privateKey: string): string {
  return privateKey.includes("BEGIN") ? privateKey : privateKey.replace(/\\n/g, "\n");
}

function signJwtES256(header: object, payload: object, privateKeyPem: string): string {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signer = crypto.createSign("SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  const signature = signer.sign({ key: toPem(privateKeyPem), dsaEncoding: "ieee-p1363" });
  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
}

function signJwtRS256(header: object, payload: object, privateKeyPem: string): string {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  const signature = signer.sign(toPem(privateKeyPem));
  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
}

export class ApnsMobilePushSender implements MobilePushSender {
  async send(
    credentials: MobilePushCredentialsRecord,
    device: MobilePushDevice,
    payload: MobilePushNotificationPayload,
  ): Promise<{ providerMessageId: string | null }> {
    if (!credentials.apnsKeyId || !credentials.apnsTeamId || !credentials.apnsBundleId || !credentials.apnsPrivateKey) {
      throw new Error("Missing APNs credentials");
    }

    const jwt = signJwtES256(
      { alg: "ES256", kid: credentials.apnsKeyId },
      {
        iss: credentials.apnsTeamId,
        iat: Math.floor(Date.now() / 1000),
      },
      credentials.apnsPrivateKey,
    );

    const body = JSON.stringify({
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: "default",
      },
      url: payload.url,
      icon: payload.icon ?? undefined,
      image: payload.image ?? undefined,
    });

    const client = http2.connect("https://api.push.apple.com");
    try {
      const response = await new Promise<{ statusCode?: number; headers: http2.IncomingHttpHeaders }>((resolve, reject) => {
        const headers: http2.OutgoingHttpHeaders = {
          ":method": "POST",
          ":path": `/3/device/${device.deviceToken}`,
          authorization: `bearer ${jwt}`,
          "content-type": "application/json",
        };

        if (credentials.apnsBundleId) {
          headers["apns-topic"] = credentials.apnsBundleId;
        }

        const request = client.request(headers);

        request.setEncoding("utf8");
        request.on("response", (headers) => {
          request.on("end", () => resolve({ statusCode: Number(headers[":status"]), headers }));
        });
        request.on("error", reject);
        request.end(body);
      });

      if (response.statusCode !== 200) {
        throw new Error(`APNs responded with ${response.statusCode}`);
      }

      return {
        providerMessageId: response.headers["apns-id"] ? String(response.headers["apns-id"]) : null,
      };
    } finally {
      client.close();
    }
  }
}

export class FcmMobilePushSender implements MobilePushSender {
  async send(
    credentials: MobilePushCredentialsRecord,
    device: MobilePushDevice,
    payload: MobilePushNotificationPayload,
  ): Promise<{ providerMessageId: string | null }> {
    if (!credentials.fcmProjectId || !credentials.fcmClientEmail || !credentials.fcmPrivateKey) {
      throw new Error("Missing FCM credentials");
    }

    const now = Math.floor(Date.now() / 1000);
    const assertion = signJwtRS256(
      { alg: "RS256", typ: "JWT" },
      {
        iss: credentials.fcmClientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      },
      credentials.fcmPrivateKey,
    );

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Unable to obtain FCM token: ${tokenResponse.status}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${credentials.fcmProjectId}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${tokenData.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: device.deviceToken,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: {
              url: payload.url,
              icon: payload.icon ?? "",
              image: payload.image ?? "",
            },
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`FCM responded with ${response.status}`);
    }

    const data = (await response.json()) as { name?: string };
    return {
      providerMessageId: data.name ?? null,
    };
  }
}
