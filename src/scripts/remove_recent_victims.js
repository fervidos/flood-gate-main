/**
 * Remove the most recent 12 victims from the database
 * This script deletes the 12 most recently seen victims
 */

import { Database } from '../db/database.js';

async function removeRecentVictims() {
    try {
        await Database.init();
        console.log('🔍 Finding the 12 most recent victims...\n');

        // Get the 12 most recent victims based on last_seen timestamp
        const recentVictims = await Database.getAll(
            `SELECT username, first_seen, last_seen, success_count, failed_count 
             FROM victims 
             ORDER BY last_seen DESC 
             LIMIT 1`
        );

        if (recentVictims.length === 0) {
            console.log('❌ No victims found in the database.');
            process.exit(0);
        }

        console.log(`Found ${recentVictims.length} victim(s) to remove:\n`);
        recentVictims.forEach((victim, index) => {
            console.log(`${index + 1}. ${victim.username}`);
            console.log(`   First Seen: ${victim.first_seen}`);
            console.log(`   Last Seen: ${victim.last_seen}`);
            console.log(`   Success: ${victim.success_count}, Failed: ${victim.failed_count}\n`);
        });

        // Extract usernames for deletion
        const usernamesToDelete = recentVictims.map(v => v.username);

        // Delete related data from message_stats
        console.log('🗑️  Deleting related message stats...');
        for (const username of usernamesToDelete) {
            await Database.run('DELETE FROM message_stats WHERE victim_username = ?', [username]);
        }

        // Delete related data from recent_messages
        console.log('🗑️  Deleting related recent messages...');
        for (const username of usernamesToDelete) {
            await Database.run('DELETE FROM recent_messages WHERE victim_username = ?', [username]);
        }

        // Delete the victims themselves
        console.log('🗑️  Deleting victims...');
        for (const username of usernamesToDelete) {
            await Database.run('DELETE FROM victims WHERE username = ?', [username]);
        }

        console.log(`\n✅ Successfully removed ${recentVictims.length} victim(s) from the database.`);

        // Show remaining victim count
        const remainingCount = (await Database.getOne('SELECT COUNT(*) as count FROM victims')).count;
        console.log(`📊 Remaining victims in database: ${remainingCount}`);

    } catch (error) {
        console.error('❌ Error removing victims:', error);
        process.exit(1);
    }
}

removeRecentVictims();
