/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package htmltext

import "testing"

func TestFetchFirstImage(t *testing.T) {
	tests := []struct {
		name string
		html string
		want string
	}{
		{
			name: "markdown-rendered image",
			html: `<p>Lower leaves are going</p><img src="https://cdn.example/leaf.jpg" alt="leaf">`,
			want: "https://cdn.example/leaf.jpg",
		},
		{
			name: "takes the first of several",
			html: `<img src="/one.png"><img src="/two.png">`,
			want: "/one.png",
		},
		{
			name: "src not the first attribute",
			html: `<img alt="week 4" loading="lazy" src="/late.jpg" width="800">`,
			want: "/late.jpg",
		},
		{
			name: "single quotes",
			html: `<img src='/single.jpg'>`,
			want: "/single.jpg",
		},
		{
			name: "uppercase tag",
			html: `<IMG SRC="/shouty.JPG">`,
			want: "/shouty.JPG",
		},
		{
			name: "spaces around equals",
			html: `<img src = "/spaced.jpg">`,
			want: "/spaced.jpg",
		},
		{
			name: "image spread over several lines",
			html: "<img\n  alt=\"x\"\n  src=\"/multiline.jpg\"\n>",
			want: "/multiline.jpg",
		},
		// A pasted screenshot can be megabytes; embedding it in every list
		// response would dwarf the rest of the payload.
		{
			name: "skips a data URI and takes the next real image",
			html: `<img src="data:image/png;base64,iVBORw0KGgo="><img src="/real.jpg">`,
			want: "/real.jpg",
		},
		{
			name: "data URI alone yields nothing",
			html: `<img src="data:image/png;base64,iVBORw0KGgo=">`,
			want: "",
		},
		{name: "no image", html: `<p>just text</p>`, want: ""},
		{name: "empty", html: ``, want: ""},
		{name: "malformed img", html: `<img alt="no src here">`, want: ""},
		{name: "empty src", html: `<img src="">`, want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := FetchFirstImage(tt.html); got != tt.want {
				t.Errorf("FetchFirstImage() = %q, want %q", got, tt.want)
			}
		})
	}
}

// The excerpt and the thumbnail are complementary: this is the exact shape of
// post that motivated the field, where the excerpt alone leaves a blank row.
func TestPhotoOnlyPostHasThumbnailButNoExcerpt(t *testing.T) {
	html := `<p></p><img src="https://cdn.example/sick-plant.jpg" alt="">`

	if excerpt := FetchExcerpt(html, "...", 240); excerpt != "" {
		t.Errorf("expected an empty excerpt for a photo-only post, got %q", excerpt)
	}
	if got := FetchFirstImage(html); got != "https://cdn.example/sick-plant.jpg" {
		t.Errorf("thumbnail = %q, want the image", got)
	}
}
