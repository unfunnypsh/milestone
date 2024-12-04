const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const cron = require('node-cron');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// In-memory storage for habits
let habits = [];

// Utility function to get today's date as a string
const getTodayDate = () => new Date().toISOString().split('T')[0];

// WebSocket Server for daily reminders
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', (ws) => {
    console.log('WebSocket client connected.');
    ws.on('message', (message) => console.log(`Received: ${message}`));
});

const sendDailyReminders = () => {
    const incompleteHabits = habits.filter(habit => {
        const today = getTodayDate();
        return !habit.completions.includes(today);
    });
    const message = {
        type: 'reminder',
        habits: incompleteHabits.map(habit => habit.name),
    };
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
};

// Cron job to send daily reminders at 8 AM
cron.schedule('0 8 * * *', sendDailyReminders);

// Endpoints

// Add Habit
app.post('/habits', (req, res) => {
    const { name, dailyGoal } = req.body;
    if (!name || !dailyGoal) {
        return res.status(400).json({ status: 'error', error: 'Name and daily goal are required.' });
    }
    const newHabit = {
        id: habits.length + 1,
        name,
        dailyGoal,
        completions: [],
    };
    habits.push(newHabit);
    res.status(201).json({ status: 'success', data: newHabit });
});

// Update Habit
app.put('/habits/:id', (req, res) => {
    const { id } = req.params;
    const habit = habits.find(h => h.id === parseInt(id));
    if (!habit) {
        return res.status(404).json({ status: 'error', error: 'Habit not found.' });
    }
    const today = getTodayDate();
    if (!habit.completions.includes(today)) {
        habit.completions.push(today);
    }
    res.status(200).json({ status: 'success', data: habit });
});

// Get Habits
app.get('/habits', (req, res) => {
    res.status(200).json({ status: 'success', data: habits });
});

// Weekly Report
app.get('/habits/report', (req, res) => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    const report = habits.map(habit => {
        const weeklyCompletions = habit.completions.filter(date => {
            const completionDate = new Date(date);
            return completionDate >= lastWeek && completionDate <= today;
        });
        return {
            name: habit.name,
            weeklyCompletions: weeklyCompletions.length,
            dailyGoal: habit.dailyGoal,
        };
    });

    res.status(200).json({ status: 'success', data: report });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('WebSocket server running on ws://localhost:8080');
});
