package ws

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const redisPubSubChannel = "command:board"

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	redis      *redis.Client
}

func NewHub(rdb *redis.Client) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		redis:      rdb,
	}
}

func (h *Hub) Run() {
	// Subscribe to Redis for multi-instance support
	go h.subscribeRedis()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("ws client connected: %s (total: %d)", client.UserID, len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("ws client disconnected: %s (total: %d)", client.UserID, len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws marshal error: %v", err)
		return
	}

	// Publish to Redis for multi-instance support
	if h.redis != nil {
		h.redis.Publish(context.Background(), redisPubSubChannel, data)
	}

	h.broadcast <- data
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) subscribeRedis() {
	if h.redis == nil {
		return
	}

	pubsub := h.redis.Subscribe(context.Background(), redisPubSubChannel)
	defer pubsub.Close()

	for msg := range pubsub.Channel() {
		h.broadcast <- []byte(msg.Payload)
	}
}

// Client represents a connected WebSocket client
type Client struct {
	Hub    *Hub
	Conn   WSConn
	Send   chan []byte
	UserID uuid.UUID
	Role   string
}

// WSConn is an interface for WebSocket connections to allow testing
type WSConn interface {
	ReadMessage() (messageType int, p []byte, err error)
	WriteMessage(messageType int, data []byte) error
	Close() error
}
