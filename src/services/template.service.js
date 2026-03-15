import fs from 'fs';
import path from 'path';

const fsPromises = fs.promises;

const DATA_DIR = path.join(process.cwd(), 'data');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

// Default templates
const DEFAULT_TEMPLATES = {
    friendly: {
        name: 'Friendly',
        messages: [
            "Hey! How's it going? 👋",
            "Hope you're having a great day!",
            "What's up? 😊",
            "Hey there! Just wanted to say hi!",
            "How are you doing today?",
            "Sending good vibes your way! ✨",
            "Hope everything is going well!",
            "Just checking in on you!",
            "Have an amazing day! 🌟",
            "You're awesome! 💫"
        ]
    },
    funny: {
        name: 'Funny',
        messages: [
            "Why did the chicken cross the road? To send you this message! 🐔",
            "Knock knock! Who's there? An anonymous message! 😂",
            "I'm not saying you're awesome, but... okay yes I am 🎉",
            "This message was brought to you by: someone cool 😎",
            "Plot twist: this isn't actually anonymous 🤫",
            "Breaking news: You just got a message! 📰",
            "Roses are red, violets are blue, this is anonymous, and so are you! 🌹",
            "I would tell you a joke, but this IS the joke 🤡",
            "Congratulations! You've been randomly selected to receive this message! 🎊",
            "Error 404: Sender not found 🤖"
        ]
    },
    random: {
        name: 'Random',
        messages: [
            "The sky is blue, water is wet, and you just got a message 🌊",
            "Fun fact: You're reading this right now 📖",
            "Beep boop, message delivered 🤖",
            "This message will self-destruct in 3... 2... just kidding! 💥",
            "You've been visited by the message fairy ✨",
            "Sending you a virtual high five! ✋",
            "This is your daily dose of randomness 🎲",
            "The answer is 42. What was the question? 🤔",
            "You just lost the game 🎮",
            "Stay hydrated! 💧"
        ]
    },
    motivational: {
        name: 'Motivational',
        messages: [
            "You're capable of amazing things! 💪",
            "Believe in yourself! You've got this! 🌟",
            "Today is a new opportunity to be great!",
            "Your potential is limitless! ✨",
            "Keep pushing forward, you're doing great! 🚀",
            "You are stronger than you think! 💎",
            "Success is just around the corner! 🎯",
            "You're making progress every day! 📈",
            "Don't give up, you're almost there! 🏆",
            "You inspire others more than you know! 💫"
        ]
    }
};

// Load custom templates
let customTemplates = {};
try {
    if (fs.existsSync(TEMPLATES_FILE)) {
        customTemplates = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
    }
} catch (e) {
    console.error('Failed to load templates:', e);
}

export const TemplateService = {
    /**
     * Get all available templates
     */
    getAll() {
        return {
            ...DEFAULT_TEMPLATES,
            ...customTemplates
        };
    },

    /**
     * Get a specific template by ID
     */
    get(templateId) {
        const allTemplates = this.getAll();
        return allTemplates[templateId] || null;
    },

    /**
     * Get random message from a template
     */
    getRandomMessage(templateId) {
        const template = this.get(templateId);
        if (!template || !template.messages || template.messages.length === 0) {
            return null;
        }
        return template.messages[Math.floor(Math.random() * template.messages.length)];
    },

    /**
     * Get multiple random messages from a template
     */
    getRandomMessages(templateId, count = 10) {
        const template = this.get(templateId);
        if (!template || !template.messages || template.messages.length === 0) {
            return [];
        }

        const messages = [];
        for (let i = 0; i < count; i++) {
            messages.push(template.messages[Math.floor(Math.random() * template.messages.length)]);
        }
        return messages;
    },

    /**
     * Process message with variable substitution
     */
    processMessage(message, variables = {}) {
        let processed = message;

        // Default variables
        const defaults = {
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString(),
            emoji: this.getRandomEmoji(),
            name: 'friend'
        };

        const allVars = { ...defaults, ...variables };

        // Replace variables
        Object.keys(allVars).forEach(key => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            processed = processed.replace(regex, allVars[key]);
        });

        return processed;
    },

    /**
     * Get random emoji
     */
    getRandomEmoji() {
        const emojis = ['😊', '👋', '✨', '🌟', '💫', '🎉', '🎊', '💪', '🚀', '⚡', '🔥', '💯', '👍', '❤️', '💙', '💚'];
        return emojis[Math.floor(Math.random() * emojis.length)];
    },

    /**
     * Create custom template
     */
    async create(templateId, name, messages) {
        if (DEFAULT_TEMPLATES[templateId]) {
            throw new Error('Cannot override default template');
        }

        customTemplates[templateId] = {
            name,
            messages,
            createdAt: new Date().toISOString()
        };

        await this.save();
        return customTemplates[templateId];
    },

    /**
     * Update custom template
     */
    async update(templateId, updates) {
        if (DEFAULT_TEMPLATES[templateId]) {
            throw new Error('Cannot modify default template');
        }

        if (!customTemplates[templateId]) {
            throw new Error('Template not found');
        }

        customTemplates[templateId] = {
            ...customTemplates[templateId],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.save();
        return customTemplates[templateId];
    },

    /**
     * Delete custom template
     */
    async delete(templateId) {
        if (DEFAULT_TEMPLATES[templateId]) {
            throw new Error('Cannot delete default template');
        }

        if (!customTemplates[templateId]) {
            return false;
        }

        delete customTemplates[templateId];
        await this.save();
        return true;
    },

    /**
     * Save custom templates to disk
     */
    async save() {
        try {
            await fsPromises.writeFile(
                TEMPLATES_FILE,
                JSON.stringify(customTemplates, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to save templates:', error);
        }
    },

    /**
     * Get template statistics
     */
    getStats() {
        const allTemplates = this.getAll();
        return {
            total: Object.keys(allTemplates).length,
            default: Object.keys(DEFAULT_TEMPLATES).length,
            custom: Object.keys(customTemplates).length,
            totalMessages: Object.values(allTemplates).reduce((sum, t) => sum + (t.messages?.length || 0), 0)
        };
    }
};
