// Runs on first mongo startup to create indexes
db = db.getSiblingDB('tasktracker');

// Indexes are also created via Mongoose, this is a safety net
print('MongoDB initialized: tasktracker database ready');
