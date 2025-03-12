<h1 align="center" id="title">SpendWise Backend</h1>

<p align="center"><img src="https://socialify.git.ci/Gabryel-w/SpendWise-Backend/image?language=1&amp;name=1&amp;owner=1&amp;pattern=Circuit+Board&amp;theme=Dark" alt="project-image"></p>

<p id="description">The backend of SpendWise is an API developed in Node.js with Supabase as the database. It handles authentication, financial transactions, and provides endpoints for spending analysis. It also includes an integrated chatbot that answers questions about personal finance.</p>

<h2>🛠️ Installation Steps:</h2>

<p>1. Create a project on Supabase</p>

```
Go to Supabase create an account and start a new project.
In Supabase Studio, navigate to the Tables section and create the following tables:

Database Schema:

Table: `users`
| Column      | Type        | Description               |
|------------|------------|---------------------------|
| id         | UUID        | Unique identifier        |
| name       | TEXT        | User's name              |
| email      | TEXT        | User's email             |
| password   | TEXT        | User's password (hashed) |
| created_at | TIMESTAMP   | Account creation date    |

Table: `transactions`
| Column      | Type          | Description                 |
|------------|--------------|-----------------------------|
| id         | UUID          | Unique transaction ID      |
| user_id    | UUID          | ID of the related user     |
| description| TEXT          | Description of transaction |
| type       | TEXT          | "income" or "expense"      |
| amount     | DECIMAL(10,2) | Transaction amount         |
| category   | TEXT          | Category of transaction    |
| date       | TIMESTAMP     | Date of transaction        |

```
<p>2. Clone the repository</p>

```
git clone "PROJECT_URL"
cd spendwise-backend
```
<p>3. Create the .env file</p>

```
SUPABASE_URL= YOUR_SUPABASE_URL
SUPABASE_KEY= YOUR_SUPABASE_KEY
```
<p>4. Install dependencies(requires Node.JS)</p>

```
npm install
```

<p>5. Start the server</p>

```
node server.js
```
<h2>💻 Built with</h2>

Technologies used in the project:

*   Node.Js
*   Express.js
*   Supabase
*   PostgreSQL
*   Dotenv
*   Cors
*   Axios
