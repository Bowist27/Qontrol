import axios from 'axios';
import { User } from '../../domain/User';

export class CloudAuthAdapter {
    private apiUrl: string;
    private syncKey: string;

    constructor(apiUrl: string, syncKey: string) {
        this.apiUrl = apiUrl;
        this.syncKey = syncKey;
    }

    async getUsersFromCloud(): Promise<User[]> {
        try {
            const url = `${this.apiUrl}/users/sync`;
            console.log(`Syncing from ${url} with key ${this.syncKey ? 'PRESENT' : 'MISSING'}...`);
            const response = await axios.get(url, {
                headers: {
                    'X-Sync-Key': this.syncKey,
                },
                timeout: 5000 // 5 seconds timeout
            });

            if (response.data && response.data.users) {
                return response.data.users;
            }
            return [];
        } catch (error) {
            console.error('Cloud Sync Error:', error);
            throw new Error('NETWORK_ERROR');
        }
    }
}
