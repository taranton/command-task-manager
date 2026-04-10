package ws

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// ReadPump pumps messages from the WebSocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister(c)
		c.Conn.Close()
	}()

	wsConn, ok := c.Conn.(*websocket.Conn)
	if ok {
		wsConn.SetReadLimit(maxMessageSize)
		wsConn.SetReadDeadline(time.Now().Add(pongWait))
		wsConn.SetPongHandler(func(string) error {
			wsConn.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})
	}

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("ws read error: %v", err)
			}
			break
		}
		// Currently we don't process incoming messages from clients
		// Future: handle client-side events
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	wsConn, ok := c.Conn.(*websocket.Conn)

	var ticker *time.Ticker
	if ok {
		ticker = time.NewTicker(pingPeriod)
		defer ticker.Stop()
	}

	defer c.Conn.Close()

	for {
		select {
		case message, ok := <-c.Send:
			if wsConn != nil {
				wsConn.SetWriteDeadline(time.Now().Add(writeWait))
			}
			if !ok {
				// Hub closed the channel
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		default:
			if ticker != nil {
				select {
				case <-ticker.C:
					if wsConn != nil {
						wsConn.SetWriteDeadline(time.Now().Add(writeWait))
					}
					if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				case message, ok := <-c.Send:
					if wsConn != nil {
						wsConn.SetWriteDeadline(time.Now().Add(writeWait))
					}
					if !ok {
						c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
						return
					}
					if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
						return
					}
				}
			} else {
				message, ok := <-c.Send
				if !ok {
					return
				}
				if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
					return
				}
			}
		}
	}
}
