module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join incident room
        socket.on('join_incident', (incidentId) => {
            socket.join(`incident_${incidentId}`);
            console.log(`Socket ${socket.id} joined incident ${incidentId}`);
        });

        // Leave incident room
        socket.on('leave_incident', (incidentId) => {
            socket.leave(`incident_${incidentId}`);
            console.log(`Socket ${socket.id} left incident ${incidentId}`);
        });

        // Real-time location update
        socket.on('update_location', (data) => {
            socket.broadcast.emit('location_updated', data);
        });

        // Incident update
        socket.on('incident_update', (data) => {
            io.to(`incident_${data.incidentId}`).emit('incident_updated', data);
        });

        // Disconnect
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};