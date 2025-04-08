# Flight Tracker

## Setup Instructions

Follow these steps to get the project up and running:

1. Install the required dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Navigate to the ```flight_dashboard``` directory:

   ```bash
   cd flight_dashboard
   ```

3. Collect static files for Django:

   ```bash
   python manage.py collectstatic
   ```

4. Start Django server:

    ```bash
    python manage.py runserver
    ```

Now the application should be running locally at ```http://127.0.0.1:8000/```
