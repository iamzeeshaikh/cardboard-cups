"""Throwaway SMTP server used to prove the quote endpoint really delivers mail."""
import socket
import threading
import sys

OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/smtp-capture.txt'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 2525


def handle(conn):
    f = conn.makefile('rwb')

    def send(line):
        f.write(line.encode() + b'\r\n')
        f.flush()

    send('220 localhost ESMTP sink')
    data_mode, captured = False, []
    while True:
        line = f.readline()
        if not line:
            break
        text = line.decode('utf-8', 'replace').rstrip('\r\n')
        if data_mode:
            if text == '.':
                data_mode = False
                send('250 2.0.0 Ok: queued')
                with open(OUT, 'w') as fh:
                    fh.write('\n'.join(captured))
                continue
            captured.append(text)
            continue
        cmd = text.split(' ')[0].upper()
        if cmd == 'EHLO' or cmd == 'HELO':
            send('250-localhost')
            send('250-AUTH PLAIN LOGIN')
            send('250 8BITMIME')
        elif cmd == 'AUTH':
            send('235 2.7.0 Authentication successful')
        elif cmd in ('MAIL', 'RCPT'):
            send('250 2.1.0 Ok')
        elif cmd == 'DATA':
            send('354 End data with <CR><LF>.<CR><LF>')
            data_mode = True
        elif cmd == 'QUIT':
            send('221 2.0.0 Bye')
            break
        else:
            send('250 2.0.0 Ok')
    conn.close()


srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(('127.0.0.1', PORT))
srv.listen(5)
print(f'smtp sink on 127.0.0.1:{PORT} -> {OUT}', flush=True)
while True:
    c, _ = srv.accept()
    threading.Thread(target=handle, args=(c,), daemon=True).start()
