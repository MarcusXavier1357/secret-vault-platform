package secrets

import "database/sql"

var DB *sql.DB

func Init(db *sql.DB) {
	DB = db
}
