class FriendMap {
    constructor() {
        this.friends = JSON.parse(localStorage.getItem('friends') || '[]');
        this.map = null;
        this.markers = [];
        this.init();
        this.loadDemoData();
    }

    init() {
        this.initMap();
        this.initTabs();
        this.initForms();
        this.loadFriends();
        this.updateReminders();
        this.updateTravelSuggestions();
    }

    initMap() {
        this.map = L.map('map').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    initTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.showTab(tabName);
            });
        });
    }

    showTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-view`).classList.add('active');
        
        if (tabName === 'map') {
            setTimeout(() => this.map.invalidateSize(), 100);
        }
    }

    initForms() {
        document.getElementById('friend-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addFriend();
        });
    }

    async addFriend() {
        const name = document.getElementById('friend-name').value;
        const location = document.getElementById('friend-location').value;
        const lastContact = document.getElementById('last-contact').value;
        const canStay = document.getElementById('can-stay').checked;
        const notes = document.getElementById('friend-notes').value;

        const coords = await this.geocodeLocation(location);
        
        const friend = {
            id: Date.now(),
            name,
            location,
            coordinates: coords,
            lastContact: new Date(lastContact),
            canStay,
            notes
        };

        this.friends.push(friend);
        this.saveFriends();
        this.loadFriends();
        this.updateReminders();
        this.updateTravelSuggestions();
        
        document.getElementById('friend-form').reset();
    }

    async geocodeLocation(location) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
            const data = await response.json();
            if (data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            }
        } catch (error) {
            console.error('Geocoding error:', error);
        }
        return { lat: 0, lng: 0 };
    }

    loadFriends() {
        this.clearMarkers();
        this.renderFriendsList();
        this.addMarkersToMap();
    }

    clearMarkers() {
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
    }

    addMarkersToMap() {
        this.friends.forEach(friend => {
            if (friend.coordinates && friend.coordinates.lat !== 0) {
                const daysSinceContact = Math.floor((new Date() - new Date(friend.lastContact)) / (1000 * 60 * 60 * 24));
                
                let iconColor = 'green';
                if (daysSinceContact > 90) iconColor = 'red';
                else if (daysSinceContact > 30) iconColor = 'orange';
                
                const icon = L.divIcon({
                    className: `custom-marker ${iconColor} ${friend.canStay ? 'accommodation' : ''}`,
                    html: `<div class="marker-content">${friend.name.charAt(0)}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                const marker = L.marker([friend.coordinates.lat, friend.coordinates.lng], { icon })
                    .addTo(this.map)
                    .bindPopup(`
                        <strong>${friend.name}</strong><br>
                        ${friend.location}<br>
                        Last contact: ${new Date(friend.lastContact).toLocaleDateString()}<br>
                        ${friend.canStay ? '🏠 Can stay here' : ''}<br>
                        ${friend.notes ? `<em>${friend.notes}</em>` : ''}
                    `);

                this.markers.push(marker);
            }
        });
    }

    renderFriendsList() {
        const container = document.getElementById('friends-container');
        container.innerHTML = '';

        this.friends.forEach(friend => {
            const friendElement = document.createElement('div');
            friendElement.className = 'friend-card';
            
            const daysSinceContact = Math.floor((new Date() - new Date(friend.lastContact)) / (1000 * 60 * 60 * 24));
            const statusClass = daysSinceContact > 90 ? 'overdue' : daysSinceContact > 30 ? 'overdue' : 'recent';
            const statusText = daysSinceContact > 90 ? 'Needs attention' : daysSinceContact > 30 ? 'Check in soon' : 'Recently contacted';
            
            friendElement.innerHTML = `
                <h3>${friend.name}</h3>
                <div class="contact-status ${statusClass}">
                    ${statusText} • ${daysSinceContact} days ago
                </div>
                <p>📍 ${friend.location}</p>
                <p>💬 Last contact: ${new Date(friend.lastContact).toLocaleDateString()}</p>
                ${friend.canStay ? '<p>🏠 Can stay here</p>' : ''}
                ${friend.notes ? `<p><em>${friend.notes}</em></p>` : ''}
                <button onclick="friendMap.removeFriend(${friend.id})">Remove</button>
            `;
            
            container.appendChild(friendElement);
        });
    }

    updateReminders() {
        const container = document.getElementById('overdue-friends');
        container.innerHTML = '';

        const overdueFriends = this.friends.filter(friend => {
            const daysSinceContact = Math.floor((new Date() - new Date(friend.lastContact)) / (1000 * 60 * 60 * 24));
            return daysSinceContact > 30;
        });

        if (overdueFriends.length === 0) {
            container.innerHTML = '<p>All caught up! 🎉</p>';
            return;
        }

        overdueFriends.forEach(friend => {
            const daysSinceContact = Math.floor((new Date() - new Date(friend.lastContact)) / (1000 * 60 * 60 * 24));
            const reminderElement = document.createElement('div');
            reminderElement.className = `reminder-card ${daysSinceContact > 90 ? 'urgent' : ''}`;
            
            reminderElement.innerHTML = `
                <h3>${friend.name}</h3>
                <p>📍 ${friend.location}</p>
                <p>⏰ ${daysSinceContact} days since last contact</p>
                <button onclick="friendMap.markContacted(${friend.id})">Mark as contacted today</button>
            `;
            
            container.appendChild(reminderElement);
        });
    }

    updateTravelSuggestions() {
        const container = document.getElementById('travel-suggestions');
        container.innerHTML = '';

        const friendsByCountry = {};
        this.friends.forEach(friend => {
            const country = friend.location.split(',').pop().trim();
            if (!friendsByCountry[country]) {
                friendsByCountry[country] = [];
            }
            friendsByCountry[country].push(friend);
        });

        Object.entries(friendsByCountry).forEach(([country, friends]) => {
            if (friends.length > 1) {
                const suggestionElement = document.createElement('div');
                suggestionElement.className = 'travel-suggestion';
                
                const accommodationOptions = friends.filter(f => f.canStay);
                
                suggestionElement.innerHTML = `
                    <h3>🌍 ${country}</h3>
                    <p>You have ${friends.length} friends here: ${friends.map(f => f.name).join(', ')}</p>
                    ${accommodationOptions.length > 0 ? 
                        `<p>🏠 Can stay with: ${accommodationOptions.map(f => f.name).join(', ')}</p>` : 
                        '<p>No accommodation options available</p>'
                    }
                `;
                
                container.appendChild(suggestionElement);
            }
        });

        if (container.innerHTML === '') {
            container.innerHTML = '<p>Add more friends to see travel suggestions!</p>';
        }
    }

    markContacted(friendId) {
        const friend = this.friends.find(f => f.id === friendId);
        if (friend) {
            friend.lastContact = new Date();
            this.saveFriends();
            this.loadFriends();
            this.updateReminders();
        }
    }

    removeFriend(friendId) {
        this.friends = this.friends.filter(f => f.id !== friendId);
        this.saveFriends();
        this.loadFriends();
        this.updateReminders();
        this.updateTravelSuggestions();
    }

    saveFriends() {
        localStorage.setItem('friends', JSON.stringify(this.friends));
    }

    loadDemoData() {
        if (this.friends.length === 0) {
            const demoFriends = [
                {
                    id: 1,
                    name: "Alex",
                    location: "Berlin, Germany",
                    coordinates: { lat: 52.5200, lng: 13.4050 },
                    lastContact: new Date('2024-06-15'),
                    canStay: true,
                    notes: "Amazing photographer, has a cozy apartment in Kreuzberg"
                },
                {
                    id: 2,
                    name: "Sam",
                    location: "Stockholm, Sweden",
                    coordinates: { lat: 59.3293, lng: 18.0686 },
                    lastContact: new Date('2024-06-20'),
                    canStay: true,
                    notes: "Tech startup founder, guest room available"
                },
                {
                    id: 3,
                    name: "Jordan",
                    location: "London, UK",
                    coordinates: { lat: 51.5074, lng: -0.1278 },
                    lastContact: new Date('2024-07-01'),
                    canStay: false,
                    notes: "Sister Riley lives in Lisbon - can connect us!"
                },
                {
                    id: 4,
                    name: "Riley",
                    location: "Lisbon, Portugal",
                    coordinates: { lat: 38.7223, lng: -9.1393 },
                    lastContact: new Date('2024-04-10'),
                    canStay: true,
                    notes: "Jordan's sister, cat sitting available, speaks fluent Portuguese"
                },
                {
                    id: 5,
                    name: "Casey",
                    location: "Sydney, Australia",
                    coordinates: { lat: -33.8688, lng: 151.2093 },
                    lastContact: new Date('2024-03-15'),
                    canStay: true,
                    notes: "Surfer, has a place near Bondi Beach"
                },
                {
                    id: 6,
                    name: "Taylor",
                    location: "Melbourne, Australia",
                    coordinates: { lat: -37.8136, lng: 144.9631 },
                    lastContact: new Date('2024-05-22'),
                    canStay: false,
                    notes: "Coffee expert, knows all the best spots"
                },
                {
                    id: 7,
                    name: "Morgan",
                    location: "Brisbane, Australia",
                    coordinates: { lat: -27.4698, lng: 153.0251 },
                    lastContact: new Date('2024-02-28'),
                    canStay: true,
                    notes: "Adventure guide, has a spare room and local knowledge"
                },
                {
                    id: 8,
                    name: "Avery",
                    location: "Brussels, Belgium",
                    coordinates: { lat: 50.8503, lng: 4.3517 },
                    lastContact: new Date('2024-07-05'),
                    canStay: false,
                    notes: "Meeting up in Brussels in August! EU policy expert"
                },
                {
                    id: 9,
                    name: "River",
                    location: "Barcelona, Spain",
                    coordinates: { lat: 41.3851, lng: 2.1734 },
                    lastContact: new Date('2024-01-20'),
                    canStay: true,
                    notes: "Architect, gorgeous apartment near Park Güell"
                },
                {
                    id: 10,
                    name: "Sage",
                    location: "Tokyo, Japan",
                    coordinates: { lat: 35.6762, lng: 139.6503 },
                    lastContact: new Date('2024-06-30'),
                    canStay: false,
                    notes: "Game developer, amazing ramen recommendations"
                }
            ];

            this.friends = demoFriends;
            this.saveFriends();
        }
    }
}

const friendMap = new FriendMap();