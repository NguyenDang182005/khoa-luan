import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    if (getApps().length > 0) {
      this.app = getApps()[0]!;
      return;
    }

    const serviceAccountJson = this.configService.get<string>(
      "FIREBASE_SERVICE_ACCOUNT_JSON",
    );
    if (!serviceAccountJson) {
      this.logger.warn(
        "FIREBASE_SERVICE_ACCOUNT_JSON not set — Firebase auth disabled",
      );
      return;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    this.app = initializeApp({ credential: cert(serviceAccount) });
    this.logger.log("Firebase Admin SDK initialized (project: " + serviceAccount.project_id + ")");
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.app) {
      throw new Error("Firebase Admin not initialized");
    }
    return getAuth(this.app).verifyIdToken(idToken);
  }
}
