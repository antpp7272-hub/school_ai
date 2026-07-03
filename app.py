from flask import Flask, render_template, request, jsonify
import json

app = Flask(__name__)
last_topic = None

with open("school_data.json", "r", encoding="utf-8") as file:
    school_data = json.load(file)
    
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/ask", methods=["POST"])
def ask():

    global last_topic

    question = request.json["question"].lower()

    answer = "ผมยังไม่มีข้อมูล"

    for topic in school_data:

        keywords = school_data[topic]["keywords"]

        for word in keywords:

            if word.lower() in question:

                answer = school_data[topic]["answer"]
                last_topic = topic

    if "อายุ" in question:

        if last_topic == "director":

            answer = school_data["director"]["age"]

    return jsonify({
        "answer": answer
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)