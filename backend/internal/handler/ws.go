package handler

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/qrt/command/internal/service"
	"github.com/qrt/command/internal/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // CORS is handled by middleware
	},
}

type WSHandler struct {
	hub         *ws.Hub
	authService *service.AuthService
}

func NewWSHandler(hub *ws.Hub, authService *service.AuthService) *WSHandler {
	return &WSHandler{hub: hub, authService: authService}
}

func (h *WSHandler) HandleConnect(w http.ResponseWriter, r *http.Request) {
	// Authenticate via query parameter token (WebSocket doesn't support headers easily)
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	userID, role, err := h.authService.ValidateToken(token)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}

	client := &ws.Client{
		Hub:    h.hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: userID,
		Role:   role,
	}

	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
