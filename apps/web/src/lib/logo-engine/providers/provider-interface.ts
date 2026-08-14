/**
 * Abstract Interface for Logo Providers in arthaX Provider Pipeline
 */

import { ProviderResult } from "../types";

export interface LogoProvider {
  name: string;
  priority: number;
  fetchLogo(domain: string): Promise<ProviderResult>;
}
