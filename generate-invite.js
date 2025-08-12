import dotenv from 'dotenv';
dotenv.config();

const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!applicationId) {
    console.error('❌ DISCORD_APPLICATION_ID not found in .env file');
    process.exit(1);
}

// Permissions calculation:
// Send Messages: 2048
// Use Slash Commands: 2147483648  
// Embed Links: 16384
// Read Message History: 65536
// Total: 277025459200

const permissions = '277025459200';
const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${applicationId}&permissions=${permissions}&scope=bot%20applications.commands`;

console.log('🔗 Bot Invite URL:');
console.log(inviteUrl);
console.log('\n📋 Steps to add bot to your server:');
console.log('1. Click the link above (or copy/paste into browser)');
console.log('2. Select your Discord server from dropdown');
console.log('3. Make sure all permissions are checked');
console.log('4. Click "Authorize"');
console.log('5. Complete CAPTCHA if prompted');
console.log('\n✅ Your bot will then appear in your server member list!');