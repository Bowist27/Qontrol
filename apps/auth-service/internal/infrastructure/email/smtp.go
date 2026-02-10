package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"
)

// EmailService handles sending emails via SMTP
type EmailService struct {
	host     string
	port     string
	user     string
	password string
	from     string
	appURL   string
	enabled  bool
}

// NewEmailService creates a new email service from environment variables
func NewEmailService() *EmailService {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")
	appURL := os.Getenv("APP_URL")

	if appURL == "" {
		appURL = "http://localhost:5173"
	}

	enabled := host != "" && port != "" && user != "" && password != ""

	if enabled {
		log.Printf("📧 Email service configured: %s:%s (from: %s)", host, port, from)
	} else {
		log.Println("📧 Email service NOT configured (SMTP env vars missing) - emails will be logged to console")
	}

	return &EmailService{
		host:     host,
		port:     port,
		user:     user,
		password: password,
		from:     from,
		appURL:   appURL,
		enabled:  enabled,
	}
}

// SendWelcomeEmail sends a welcome email with account activation link to a new user
func (s *EmailService) SendWelcomeEmail(toEmail, firstName, resetToken string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.appURL, resetToken)

	subject := "Activa tu cuenta en QONTROL"

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; color: #334155; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04); }
        .header { padding: 40px 40px 0; text-align: center; }
        .logo { font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: 1.5px; margin: 0; }
        .logo-dot { color: #2563eb; }
        .divider { width: 40px; height: 3px; background: #2563eb; border-radius: 2px; margin: 20px auto 0; }
        .body { padding: 32px 40px 40px; }
        .title { font-size: 22px; font-weight: 600; color: #0f172a; margin: 0 0 8px; text-align: center; }
        .subtitle { font-size: 14px; color: #64748b; text-align: center; margin: 0 0 28px; }
        .greeting { font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 24px; }
        .user-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin: 0 0 28px; }
        .user-card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin: 0 0 4px; font-weight: 600; }
        .user-card-email { font-size: 14px; color: #1e293b; font-weight: 500; margin: 0; }
        .cta-wrapper { text-align: center; margin: 0 0 24px; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 40px; border-radius: 10px; font-weight: 600; font-size: 14px; letter-spacing: 0.3px; }
        .expire-note { font-size: 13px; color: #94a3b8; text-align: center; margin: 0 0 24px; }
        .fallback { font-size: 12px; color: #cbd5e1; text-align: center; margin: 0; line-height: 1.6; }
        .fallback a { color: #94a3b8; word-break: break-all; }
        .footer { padding: 20px 40px; text-align: center; border-top: 1px solid #f1f5f9; }
        .footer p { font-size: 11px; color: #cbd5e1; margin: 0; line-height: 1.5; }
        .footer a { color: #94a3b8; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <p class="logo">QONTROL<span class="logo-dot">.</span></p>
            <div class="divider"></div>
        </div>
        <div class="body">
            <h1 class="title">¡Bienvenido a QONTROL!</h1>
            <p class="subtitle">Tu cuenta ha sido creada exitosamente</p>

            <p class="greeting">Hola, %s:</p>
            <p class="greeting">Tu cuenta está lista. Para comenzar a gestionar inventarios, activa tu cuenta estableciendo una contraseña segura.</p>
            
            <div class="user-card">
                <p class="user-card-label">Tu cuenta</p>
                <p class="user-card-email">%s</p>
            </div>
            
            <div class="cta-wrapper">
                <a href="%s" class="btn">Activar mi cuenta</a>
            </div>
            
            <p class="expire-note">Por seguridad, este enlace es válido por 48 horas.</p>

            <p class="fallback">Si el botón no funciona, copia este enlace en tu navegador:<br>
            <a href="%s">%s</a></p>
        </div>
        <div class="footer">
            <p>Enviado por QONTROL System.<br>Si no solicitaste esta cuenta, puedes ignorar este correo.</p>
        </div>
    </div>
</body>
</html>`, firstName, toEmail, resetURL, resetURL, resetURL)

	if !s.enabled {
		// Log to console when SMTP is not configured
		log.Println("════════════════════════════════════════════════")
		log.Println("📧 EMAIL (console mode - SMTP not configured)")
		log.Printf("   To: %s", toEmail)
		log.Printf("   Subject: %s", subject)
		log.Printf("   Reset URL: %s", resetURL)
		log.Println("════════════════════════════════════════════════")
		return nil
	}

	return s.sendEmail(toEmail, subject, htmlBody)
}

// sendEmail sends an email via SMTP (supports both STARTTLS on 587 and implicit TLS on 465)
func (s *EmailService) sendEmail(to, subject, htmlBody string) error {
	// Build MIME message
	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("From: QONTROL <%s>\r\n", s.from))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	addr := fmt.Sprintf("%s:%s", s.host, s.port)
	auth := smtp.PlainAuth("", s.user, s.password, s.host)

	var err error
	if s.port == "465" {
		// Implicit TLS (SSL) — used by Resend, some providers
		err = s.sendMailTLS(addr, auth, s.from, []string{to}, []byte(msg.String()))
	} else {
		// STARTTLS (port 587) — standard SMTP
		err = smtp.SendMail(addr, auth, s.from, []string{to}, []byte(msg.String()))
	}

	if err != nil {
		log.Printf("❌ Error sending email to %s: %v", to, err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("✅ Email sent successfully to %s", to)
	return nil
}

// sendMailTLS sends email over implicit TLS (port 465)
func (s *EmailService) sendMailTLS(addr string, auth smtp.Auth, from string, to []string, msg []byte) error {
	log.Printf("📧 Connecting to SMTP server %s via TLS...", addr)

	tlsConfig := &tls.Config{
		ServerName: s.host,
	}

	dialer := &net.Dialer{Timeout: 15 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("TLS dial failed: %w", err)
	}
	defer conn.Close()

	host, _, _ := net.SplitHostPort(addr)
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("SMTP client creation failed: %w", err)
	}
	defer client.Close()

	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP auth failed: %w", err)
	}

	if err = client.Mail(from); err != nil {
		return fmt.Errorf("SMTP MAIL FROM failed: %w", err)
	}

	for _, addr := range to {
		if err = client.Rcpt(addr); err != nil {
			return fmt.Errorf("SMTP RCPT TO failed: %w", err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA failed: %w", err)
	}

	_, err = w.Write(msg)
	if err != nil {
		return fmt.Errorf("SMTP write failed: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("SMTP close failed: %w", err)
	}

	return client.Quit()
}
