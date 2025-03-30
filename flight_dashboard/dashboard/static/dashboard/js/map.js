// Initialize map centered on Singapore
const map = L.map('map').setView([1.3521, 103.8198], 10);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Create object to store markers
let flightMarkers = {};

// Create radius circles
const radiusCircles = [
	{ radius: 15000, color: '#ff4444' },  // 15km
	{ radius: 30000, color: '#ff8800' },  // 30km
	{ radius: 45000, color: '#00C851' },  // 45km
	{ radius: 60000, color: '#33b5e5' }   // 60km
].map(circle => L.circle([1.3521, 103.8198], {
	radius: circle.radius,
	color: circle.color,
	fill: false,
	dashArray: '5, 10',
	weight: 1
}).addTo(map));

// Custom airplane icon
const planeIcon = L.divIcon({
	html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="#2196F3">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
           </svg>`,
	className: 'plane-icon',
	iconSize: [20, 20],
	iconAnchor: [10, 10]
});

// Function to format flight information
function formatFlightInfo(flight) {
	return `
        <div class="flight-detail"><span>Callsign:</span> <span>${flight.callsign}</span></div>
        <div class="flight-detail"><span>Country:</span> <span>${flight.origin_country}</span></div>
        <div class="flight-detail"><span>Altitude:</span> <span>${flight.altitude}</span></div>
        <div class="flight-detail"><span>Speed:</span> <span>${flight.velocity}</span></div>
        <div class="flight-detail"><span>Heading:</span> <span>${flight.heading}</span></div>
        <div class="flight-detail"><span>Position:</span> <span>${flight.lat.toFixed(4)}, ${flight.lon.toFixed(4)}</span></div>
    `;
}

// Function to update weather information
async function updateWeather(lat, lon) {
	try {
		const response = await fetch(`/api/weather/?lat=${lat}&lon=${lon}`);
		const data = await response.json();

		if (data.error) {
			throw new Error(data.error);
		}

		const weatherHtml = `
            <div class="flight-detail"><span>Temperature:</span> <span>${data.temperature}</span></div>
            <div class="flight-detail"><span>Feels Like:</span> <span>${data.feels_like}</span></div>
            <div class="flight-detail"><span>Condition:</span> <span>${data.condition}</span></div>
            <div class="flight-detail"><span>Wind Speed:</span> <span>${data.wind_speed}</span></div>
            <div class="flight-detail"><span>Humidity:</span> <span>${data.humidity}</span></div>
            <div class="flight-detail"><span>Pressure:</span> <span>${data.pressure}</span></div>
        `;

		document.querySelector('.weather-data').innerHTML = weatherHtml;
		document.getElementById('weather-info').classList.remove('hidden');
	} catch (error) {
		console.error('Weather update failed:', error);
	}
}

// Function to update flight markers
async function updateFlights() {
	try {
		const response = await fetch('/api/flights/');
		const flights = await response.json();

		if (!Array.isArray(flights)) {
			throw new Error('Invalid flight data received');
		}

		// Track existing flights to remove stale markers
		const activeFlight = new Set();

		flights.forEach(flight => {
			const id = flight.callsign;
			activeFlight.add(id);

			if (flightMarkers[id]) {
				// Update existing marker position
				flightMarkers[id].setLatLng([flight.lat, flight.lon]);
				flightMarkers[id].setRotationAngle(parseFloat(flight.heading) || 0);
			} else {
				// Create new marker
				const marker = L.marker([flight.lat, flight.lon], {
					icon: planeIcon,
					rotationAngle: parseFloat(flight.heading) || 0
				}).addTo(map);

				// Add click handler
				marker.on('click', () => {
					document.getElementById('flight-info').innerHTML = formatFlightInfo(flight);
					updateWeather(flight.lat, flight.lon);
				});

				flightMarkers[id] = marker;
			}
		});

		// Remove stale markers
		Object.keys(flightMarkers).forEach(id => {
			if (!activeFlight.has(id)) {
				map.removeLayer(flightMarkers[id]);
				delete flightMarkers[id];
			}
		});

	} catch (error) {
		console.error('Flight update failed:', error);
	}
}

// Update flights every 5 seconds
setInterval(updateFlights, 5000);

// Initial update
updateFlights();

// Add CSS for plane rotation
const style = document.createElement('style');
style.textContent = `
    .plane-icon svg {
        transition: transform 0.5s ease-in-out;
    }
`;
document.head.appendChild(style);
