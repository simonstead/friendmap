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
        this.updateAnalytics();
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

        // Bulk actions
        document.getElementById('mark-all-contacted').addEventListener('click', () => {
            this.markAllContacted();
        });

        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-data').click();
        });

        document.getElementById('import-data').addEventListener('change', (e) => {
            this.importData(e);
        });

        // Voice input (using Web Speech API if available)
        document.getElementById('voice-input-btn').addEventListener('click', () => {
            this.startVoiceInput();
        });

        // Route planning
        document.getElementById('suggest-route').addEventListener('click', () => {
            this.suggestRoute();
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
        this.updateAnalytics();
        
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
        this.updateAnalytics();
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

    markAllContacted() {
        const overdueFriends = this.friends.filter(friend => {
            const daysSinceContact = Math.floor((new Date() - new Date(friend.lastContact)) / (1000 * 60 * 60 * 24));
            return daysSinceContact > 30;
        });

        if (overdueFriends.length === 0) {
            alert('No overdue friends to update!');
            return;
        }

        if (confirm(`Mark ${overdueFriends.length} friends as contacted today?`)) {
            overdueFriends.forEach(friend => {
                friend.lastContact = new Date();
            });
            this.saveFriends();
            this.loadFriends();
            this.updateReminders();
            this.updateAnalytics();
        }
    }

    exportData() {
        const data = {
            friends: this.friends,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `friendmap-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.friends && Array.isArray(data.friends)) {
                    if (confirm(`Import ${data.friends.length} friends? This will merge with your existing data.`)) {
                        // Merge imported friends with existing ones, avoiding duplicates
                        data.friends.forEach(importedFriend => {
                            const exists = this.friends.some(existing => 
                                existing.name.toLowerCase() === importedFriend.name.toLowerCase() &&
                                existing.location.toLowerCase() === importedFriend.location.toLowerCase()
                            );
                            
                            if (!exists) {
                                importedFriend.id = Date.now() + Math.random();
                                this.friends.push(importedFriend);
                            }
                        });
                        
                        this.saveFriends();
                        this.loadFriends();
                        this.updateReminders();
                        this.updateTravelSuggestions();
                        this.updateAnalytics();
                        alert('Data imported successfully!');
                    }
                } else {
                    alert('Invalid file format. Please export your data first to see the expected format.');
                }
            } catch (error) {
                alert('Error reading file. Please make sure it\'s a valid JSON file.');
            }
        };
        reader.readAsText(file);
    }

    startVoiceInput() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice input not supported in this browser. Try Chrome or Edge.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        const button = document.getElementById('voice-input-btn');
        button.textContent = '🔴 Listening...';
        button.disabled = true;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.parseVoiceInput(transcript);
        };

        recognition.onerror = (event) => {
            alert('Voice recognition error: ' + event.error);
        };

        recognition.onend = () => {
            button.textContent = '🎤 Voice Input';
            button.disabled = false;
        };

        recognition.start();
    }

    parseVoiceInput(transcript) {
        // Simple voice input parsing - could be much more sophisticated
        alert(`Voice input received: "${transcript}"\n\nParsing voice input is a demo feature. Please fill the form manually.`);
        
        // Basic parsing example (you could expand this)
        const words = transcript.toLowerCase().split(' ');
        
        // Look for patterns like "add [name] in [location]"
        if (words.includes('add') && words.includes('in')) {
            const addIndex = words.indexOf('add');
            const inIndex = words.indexOf('in');
            
            if (addIndex < inIndex) {
                const name = words.slice(addIndex + 1, inIndex).join(' ');
                const location = words.slice(inIndex + 1).join(' ');
                
                if (name && location) {
                    document.getElementById('friend-name').value = name.charAt(0).toUpperCase() + name.slice(1);
                    document.getElementById('friend-location').value = location.charAt(0).toUpperCase() + location.slice(1);
                    document.getElementById('last-contact').value = new Date().toISOString().split('T')[0];
                }
            }
        }
    }

    suggestRoute() {
        const input = document.getElementById('route-cities').value.trim();
        if (!input) {
            alert('Please enter some cities separated by commas');
            return;
        }

        const cities = input.split(',').map(city => city.trim().toLowerCase());
        const container = document.getElementById('route-suggestions');
        container.innerHTML = '';

        // Find friends in or near the specified cities
        const routeFriends = [];
        cities.forEach(city => {
            const friendsInCity = this.friends.filter(friend => 
                friend.location.toLowerCase().includes(city)
            );
            routeFriends.push(...friendsInCity.map(friend => ({ ...friend, searchCity: city })));
        });

        if (routeFriends.length === 0) {
            container.innerHTML = '<p>No friends found in the specified cities. Try broader search terms.</p>';
            return;
        }

        // Group by city and create suggestions
        const cityGroups = {};
        routeFriends.forEach(friend => {
            const city = friend.searchCity;
            if (!cityGroups[city]) cityGroups[city] = [];
            cityGroups[city].push(friend);
        });

        Object.entries(cityGroups).forEach(([city, friends]) => {
            const routeElement = document.createElement('div');
            routeElement.className = 'route-result';
            
            const accommodationFriends = friends.filter(f => f.canStay);
            const daysSinceContact = friends.map(f => Math.floor((new Date() - new Date(f.lastContact)) / (1000 * 60 * 60 * 24)));
            const avgDays = Math.round(daysSinceContact.reduce((a, b) => a + b, 0) / daysSinceContact.length);
            
            routeElement.innerHTML = `
                <h4>📍 ${city.charAt(0).toUpperCase() + city.slice(1)}</h4>
                <p><strong>${friends.length} friend${friends.length > 1 ? 's' : ''}:</strong> ${friends.map(f => f.name).join(', ')}</p>
                ${accommodationFriends.length > 0 ? 
                    `<p>🏠 <strong>Can stay with:</strong> ${accommodationFriends.map(f => f.name).join(', ')}</p>` : 
                    '<p>🏨 No accommodation available - book hotel</p>'
                }
                <p>💬 <strong>Average last contact:</strong> ${avgDays} days ago</p>
            `;
            
            container.appendChild(routeElement);
        });
    }

    updateAnalytics() {
        const totalFriends = this.friends.length;
        const countries = [...new Set(this.friends.map(f => f.location.split(',').pop().trim()))].length;
        const accommodationCount = this.friends.filter(f => f.canStay).length;
        const overdueFriends = this.friends.filter(friend => {
            const daysSinceContact = Math.floor((new Date() - new Date(friend.lastContact)) / (1000 * 60 * 60 * 24));
            return daysSinceContact > 30;
        }).length;

        document.getElementById('total-friends').textContent = totalFriends;
        document.getElementById('countries-count').textContent = countries;
        document.getElementById('accommodation-count').textContent = accommodationCount;
        document.getElementById('overdue-count').textContent = overdueFriends;
    }
}

const friendMap = new FriendMap();